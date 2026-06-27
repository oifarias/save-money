# Plano: Importação em Batch (vs. Row-by-Row)

## Contexto

Em teste de carga com 307 linhas, a importação via planilha estourou o timeout de 60 s da transação global do Prisma.

A correção imediata aplicada (mini-transação por linha de parcelamento + linhas simples sem tx) elimina o timeout, mas mantém a arquitetura de processamento **1 linha = 1 ciclo de queries**. A ideia proposta é reestruturar o pipeline em **fases batch** — resolvendo todas as categorias de uma vez, todos os templates de uma vez, e criando todas as transações num único `createMany`.

---

## Comparativo: hoje vs. proposta

### Hoje — row-by-row (após correção de timeout)

```
Para cada linha válida:
  1. safeParse (CPU)
  2. resolveRootCategory    → SELECT + possível INSERT    (1–2 queries)
  3. resolveSubcategory     → SELECT + possível INSERT    (1–2 queries)
  ── se parcelamento ──────────────────────────────────────────────────
  4. $transaction {
       createInstallmentPlan                              (1 INSERT)
       Para cada parcela: transaction.create              (N INSERTs)
       Para cada tag:     tag.upsert + transactionTag.create (2×T INSERTs)
     }
  ── se simples ───────────────────────────────────────────────────────
  4. resolveFixedExpenseTemplate → SELECT + possível INSERT (1–3 queries)
  5. transaction.create                                   (1 INSERT)
  6. Para cada tag: tag.upsert + transactionTag.create    (2×T INSERTs)
```

**Custo por 100 linhas simples sem tags:** ~400 queries  
**Custo por 100 linhas com 2 tags cada:** ~600 queries  
**Custo por linha de parcelamento 3/12 com 2 tags:** ~26 queries (1 plan + 10 tx + 10×2 tags + 4 resolve)

---

### Proposta — pipeline em fases batch

```
Fase 0 — Validação total
  • safeParse em todas as linhas de uma vez
  • Separa: válidas / inválidas / simples / parceladas / com_tags / com_fixed

Fase 1 — Categorias (2 queries totais, independente do nº de linhas)
  • Coleta nomes únicos de categoria e sub-categoria
  • SELECT WHERE name IN (...)          → encontra as existentes
  • INSERT ... createManyAndReturn(...)  → cria só as novas
  • Monta Map<nome → id>

Fase 2 — Tags (2 queries totais)
  • Coleta nomes únicos de tag
  • createMany(skipDuplicates: true)     → cria as novas
  • SELECT WHERE name IN (...)           → pega todos os IDs
  • Monta Map<nome → id>

Fase 3 — FixedExpenseTemplates (2–3 queries totais)
  • Coleta pares únicos (descrição normalizada, categoryId) das linhas fixas
  • SELECT templates ativos do usuário   → encontra matches
  • createManyAndReturn(...)             → cria só os novos
  • Monta Map<chave → templateId>

Fase 4 — InstallmentPlans (por grupo, não por linha)
  • Agrupa linhas parceladas por (baseDescription, totalInstallments)
  • Para cada grupo: createInstallmentPlan + createMany(transactions do plano)
    numa mini-tx   — atômico por plano, não por importação inteira
  • Mantém Map<chave_do_plano → [transactionId]>

Fase 5 — Transações simples (1–2 queries totais)
  • Monta array com todos os dados já resolvidos (categoryId, templateId, accountId)
  • transaction.createManyAndReturn(...)  → 1 INSERT para N linhas
  • Recebe de volta todos os IDs

Fase 6 — Tags de transação (1 query)
  • Combina Map de tags + IDs recebidos nas fases 4 e 5
  • transactionTag.createMany(skipDuplicates: true)
```

**Custo por 100 linhas simples sem tags:** ~8–10 queries  
**Custo por 100 linhas com 2 tags cada:** ~12–14 queries  
**Redução estimada de roundtrips:** ~95 % para importações grandes

---

## Ganho real por faixa de tamanho

| Linhas | Row-by-row (queries) | Batch (queries) | Tempo estimado (row) | Tempo estimado (batch) |
|-------:|---------------------:|----------------:|---------------------:|----------------------:|
| 50     | ~200                 | ~12             | 3–5 s                | < 1 s                 |
| 150    | ~600                 | ~14             | 10–20 s              | ~1 s                  |
| 307    | ~1 200               | ~16             | 60 s+ (timeout)      | ~2 s                  |
| 1 000  | ~4 000               | ~20             | > timeout            | ~5 s                  |

---

## Riscos e pontos de atenção

### 🔴 Alto — InstallmentPlan: grupos e reutilização

O código atual detecta se já existe um plano com mesma `baseDescription + totalInstallments` no banco (via `resolveInstallmentPlan`). Na fase batch, precisamos:

1. Fazer um SELECT para checar planos existentes antes de criar novos.
2. Deduplificar linhas que representam parcelas do **mesmo plano** (ex.: "Notebook (3/12)" e "Notebook (5/12)" na mesma planilha devem criar UM único plan, não dois).
3. `createManyAndReturn` para planos não é diretamente disponível com FK para transações sem conhecer os IDs antecipadamente — a fase de transações parceladas continua precisando de mini-tx por plano.

**Conclusão:** As linhas parceladas **não ganham batch de transactions** de forma trivial, apenas as linhas simples ganham.

### 🔴 Alto — FixedExpenseTemplate: lógica de normalização

`resolveFixedExpenseTemplate` tem lógica não-trivial:
- Normaliza a descrição (trim + lowercase)
- Busca template ativo por `(userId, categoryId)` e compara nomes normalizados
- Se já há template existente, reutiliza **sem sobrescrever** `expectedAmount` nem `dueDay`

Replicar essa lógica em batch exige:
- Buscar todos os templates ativos do usuário uma vez
- Aplicar a lógica de match em memória
- Criar só os genuinamente novos

Risco: o match em memória pode divergir da lógica atual se a descrição-normalização não for idêntica.

### 🟡 Médio — `createManyAndReturn` no Prisma

`createManyAndReturn` foi introduzido no Prisma 5.14. O projeto usa Prisma 7.8 — disponível. Mas:
- Não suporta nested writes (não dá para criar `Transaction` + `TransactionTag` num só `createMany`)
- Exige duas queries (createMany + findMany) quando IDs gerados precisam ser referenciados

### 🟡 Médio — Atomicidade e recuperação parcial

No batch, uma falha na Fase 5 (createMany de transactions) após a Fase 1 (criação de categorias) deixa categorias criadas sem transações vinculadas. Isso é aceitável (categorias órfãs não causam problema), mas a semântica de "o que foi importado" fica menos clara para o usuário.

Opção: envolver Fases 3–6 numa única `$transaction` de baixo custo (poucas queries grandes em vez de muitas queries pequenas).

### 🟡 Médio — Corridas de escrita (race conditions)

Com `createMany + skipDuplicates` para tags e categorias, o comportamento em escrita simultânea (dois usuários importando ao mesmo tempo) é seguro — o `skipDuplicates` mapeia para `ON CONFLICT DO NOTHING` no PostgreSQL.

Para FixedExpenseTemplates, a corrida é menos coberta — dois imports simultâneos para o mesmo usuário com a mesma descrição fixa poderiam criar dois templates. Probabilidade baixa na prática (usuário único por sessão).

### 🟢 Baixo — Compatibilidade com testes existentes

Os testes de integração (`import-actions.test.ts`, `import-actions.scenarios.test.ts`) validam o **resultado final** no banco, não o número de queries. A refatoração não muda a semântica externa, então os testes devem continuar passando sem alteração.

---

## Recomendação de escopo

Implementar batch **apenas onde o ganho é direto e o risco é baixo**:

| Fase | Batch viável? | Complexidade | Ganho |
|------|:-------------:|:------------:|:-----:|
| Categorias e sub-categorias | ✅ | Baixa | Alto |
| Tags | ✅ | Baixa | Alto |
| Transações simples | ✅ | Média | Alto |
| FixedExpenseTemplates | ⚠️ parcial | Alta | Médio |
| InstallmentPlan + parcelas | ❌ mantém mini-tx por plano | — | Baixo |

Esse escopo resolve ~90 % do problema de performance (a maioria das linhas em importações reais são simples, não parceladas) com ~30 % da complexidade de uma refatoração total.

---

## Lista de tarefas

### Infraestrutura e preparação

- [ ] **T01** Criar função `batchResolveCategories(prisma, userId, names[])` em `src/lib/category-resolver.ts`
  - findMany onde `name IN names && parentId === null`
  - createManyAndReturn para os não encontrados
  - Retorna `Map<nome → Category>`

- [ ] **T02** Criar função `batchResolveSubcategories(prisma, userId, items[{parentId, name}])` em `src/lib/category-resolver.ts`
  - SELECT com filtro `(parentId, name)` via OR ou query agrupada
  - createManyAndReturn para os não encontrados
  - Retorna `Map<"parentId:nome" → Category>`

- [ ] **T03** Criar função `batchResolveTags(prisma, userId, names[])` em `src/lib/tags.ts`
  - `createMany(skipDuplicates: true)` para criar as novas
  - `findMany WHERE name IN names` para buscar todos os IDs
  - Retorna `Map<nome → Tag>`

- [ ] **T04** Criar função `batchResolveFixedExpenseTemplates(prisma, userId, items[{description, categoryId, amount, date}])` em `src/lib/fixed-expense-resolver.ts`
  - SELECT de todos os templates ativos do usuário
  - Match em memória com normalização idêntica à função atual
  - createManyAndReturn para os genuinamente novos
  - Retorna `Map<chave → templateId>`

### Refatoração da Server Action

- [ ] **T05** Reescrever `importTransactionsAction` em `src/app/(app)/lancamentos/import-actions.ts` com o novo pipeline:

  ```
  1. safeParse de todas as linhas → separa válidas/inválidas/parceladas/simples
  2. batchResolveCategories
  3. batchResolveSubcategories
  4. batchResolveTags
  5. batchResolveFixedExpenseTemplates (só para linhas simples com isFixed=true)
  6. Para linhas parceladas: mini-tx por grupo de plano (mantém lógica atual)
  7. transaction.createManyAndReturn para linhas simples (1 query)
  8. transactionTag.createMany para todas as tag-relationships (1 query)
  ```

- [ ] **T06** Garantir que `imported` e `skipped` ainda são contabilizados corretamente no novo fluxo (linhas inválidas no Zod + linhas que falham em alguma fase)

- [ ] **T07** Remover as constantes `ROW_TX_TIMEOUT_MS` e `ROW_TX_MAX_WAIT_MS` se a mini-tx por plano usar valores inline; ou mantê-las renomeadas

### Testes

> **Padrão obrigatório para todos os testes de integração desta seção**
>
> Cada `it` deve:
> 1. Abrir uma `$transaction` do Prisma antes de qualquer escrita
> 2. Executar a função sendo testada **dentro** dessa transação (passando o `tx` como cliente)
> 3. Fazer `SELECT` direto no banco via `tx` para verificar o estado real persistido
> 4. Executar todos os `expect()`
> 5. Lançar um sentinel de rollback (`throw ROLLBACK`) ao final — o banco volta ao estado anterior e nenhum dado de teste fica gravado
>
> ```typescript
> const ROLLBACK = Symbol("rollback");
>
> async function withRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
>   await prisma.$transaction(async (tx) => {
>     await fn(tx);
>     throw ROLLBACK; // força rollback incondicional
>   }).catch((e) => {
>     if (e !== ROLLBACK) throw e; // re-lança erros reais
>   });
> }
> ```
>
> Isso elimina a necessidade de `beforeEach` com `deleteMany` e garante isolamento total entre testes, mesmo que rodem em paralelo contra o mesmo banco.

---

- [ ] **T08** Testes para `batchResolveCategories` em `tests/lib/batch-resolve-categories.test.ts`

  Cenários (todos usando `withRollback`):
  - **1 categoria nova** — verifica que foi criada no banco e o Map retorna o id correto
  - **1 categoria já existente** — verifica que não duplicou (SELECT COUNT = 1) e retorna o id existente
  - **10 categorias, 5 novas e 5 existentes** — verifica count final = soma de existentes + novas; Map tem todas as 10 entradas
  - **50 categorias todas novas** — verifica count = 50, tempo de execução dentro do tx < 2 s
  - **Nomes duplicados no input** — ex.: `["Alimentação", "Alimentação", "Transporte"]` deve criar apenas 2 registros distintos
  - **Nome vazio ou só espaços** — deve ser ignorado e não inserido no banco

---

- [ ] **T09** Testes para `batchResolveSubcategories` em `tests/lib/batch-resolve-subcategories.test.ts`

  Cenários (todos usando `withRollback`):
  - **1 sub-categoria nova sob pai existente** — verifica criação e vínculo correto de `parentId`
  - **1 sub-categoria já existente** — verifica que não duplicou
  - **Mesma sub-categoria sob pais diferentes** — ex.: "Outros" sob "Alimentação" e "Outros" sob "Transporte" devem ser dois registros distintos; Map deve diferenciar pela chave `"parentId:nome"`
  - **20 sub-categorias mistas (10 novas, 10 existentes)** — count correto, Map completo
  - **Sub-categoria com `parentId` inexistente** — deve lançar erro de FK ou retornar null, sem quebrar as demais

---

- [ ] **T10** Testes para `batchResolveTags` em `tests/lib/batch-resolve-tags.test.ts`

  Cenários (todos usando `withRollback`):
  - **5 tags novas** — verifica que todas foram criadas (`SELECT COUNT = 5`) e Map retorna todos os ids
  - **5 tags já existentes** — verifica que não duplicou (`COUNT` permanece o mesmo) e ids batem com os existentes
  - **Mix: 3 novas + 3 existentes** — COUNT cresce só 3; Map tem todas as 6 entradas
  - **100 tags todas novas** — verifica COUNT = 100 e todos os ids no Map; tempo < 1 s
  - **Tags com `#` no início** — `#lazer` deve ser normalizado para `lazer` antes de persistir
  - **Tags duplicadas no input** — `["lazer", "lazer", "comida"]` deve criar 2 registros, não 3

---

- [ ] **T11** Testes para `batchResolveFixedExpenseTemplates` em `tests/lib/batch-resolve-fixed-expense-templates.test.ts`

  Cenários (todos usando `withRollback`):
  - **1 template novo** — verifica criação com `description`, `expectedAmount`, `dueDay` e `categoryId` corretos
  - **1 template já existente (mesma descrição normalizada)** — verifica que não duplicou e retorna o id existente
  - **Descrição com capitalização diferente** — `"aluguel"` deve match com `"Aluguel"` existente
  - **Mesma descrição, categoria diferente** — deve criar template separado (não é o mesmo)
  - **10 templates, 4 existentes e 6 novos** — verifica COUNT final e que existentes não foram sobrescritos (`expectedAmount` original preservado)
  - **Template inativo existente** — não deve ser reutilizado; deve criar um novo template ativo

---

- [ ] **T12** Testes de integração para o pipeline completo em `tests/actions/lancamentos/import-batch.test.ts`

  Cada cenário usa `withRollback`; ao final faz SELECT em todas as tabelas afetadas antes do rollback:

  **Cenários de volume:**
  - **10 linhas simples, sem categoria, sem tags** — verifica 10 transactions criadas, `categoryId = null`
  - **50 linhas simples com 3 categorias distintas e 5 tags** — verifica 50 transactions; SELECT em `categories` mostra 3 registros; SELECT em `tags` mostra 5 registros; SELECT em `transaction_tags` mostra 50×(tags por linha) registros
  - **100 linhas simples todas com `isFixed = true`** — verifica 100 transactions com `isFixed = true`; verifica que templates fixos foram criados (quantidade correta de templates únicos)
  - **300 linhas simples** — verifica 300 transactions no banco; tempo de execução do pipeline (medido via `Date.now()`) < 10 s
  - **500 linhas simples** — verifica 500 transactions; tempo < 15 s

  **Cenários de parcelamento:**
  - **1 linha `3/12`** — verifica 10 transactions (parcelas 3..12), 1 `InstallmentPlan` com `totalInstallments = 12`
  - **3 linhas do mesmo plano na mesma planilha (`2/6`, `3/6`, `4/6`)** — verifica apenas 1 `InstallmentPlan` criado, com todas as parcelas 2..6 geradas (sem duplicar as parcelas já representadas)
  - **Mix: 50 simples + 5 parceladas (2/12 cada)** — verifica 50 + 5×11 = 105 transactions; 5 planos; tempo < 5 s

  **Cenários de erro e resiliência:**
  - **Linha inválida no meio do lote** — linha com `amount = ""` no meio de 10 linhas válidas; verifica que 9 transactions foram criadas e `skipped = 1`
  - **Categoria que viola constraint (nome vazio)** — não deve criar categoria inválida; linha marcada como `skipped`
  - **Lote vazio** — retorna `success: false` sem nenhuma escrita no banco

  **Cenários de idempotência:**
  - **Mesma categoria importada em duas linhas diferentes** — SELECT em `categories` mostra 1 registro, não 2
  - **Mesma tag em 20 linhas diferentes** — SELECT em `tags` mostra 1 registro; `transaction_tags` mostra 20 vínculos

---

- [ ] **T13** Regressão: rodar `import-actions.test.ts` e `import-actions.scenarios.test.ts` existentes sem alteração e garantir que todos os testes continuam passando

- [ ] **T14** Teste de carga real: executar via script o pipeline com planilha de 307 linhas (o caso que estourou o timeout original) e confirmar tempo < 10 s e `imported = 307`

### Opcional / futuro

- [ ] **T15** Avaliar envolver Fases 3–8 numa única `$transaction` (custo baixo com poucas queries grandes) para garantir atomicidade total da importação se isso for um requisito de negócio

- [ ] **T16** Explorar `createInstallmentPlanWithTransactions` em versão batch para grupos de parcelamento com o mesmo plano (ex.: múltiplas linhas "Notebook (x/12)" na mesma planilha)
