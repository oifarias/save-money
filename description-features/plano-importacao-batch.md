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

- [ ] **T08** Atualizar / adicionar testes unitários para `batchResolveCategories`, `batchResolveSubcategories`, `batchResolveTags`, `batchResolveFixedExpenseTemplates` em `tests/lib/`

- [ ] **T09** Rodar a suite completa de integração (`import-actions.test.ts` + `import-actions.scenarios.test.ts`) e garantir que todos os testes continuam passando sem alteração

- [ ] **T10** Adicionar teste de carga manual com planilha de 300+ linhas para confirmar que o tempo total fica abaixo de 10 s

### Opcional / futuro

- [ ] **T11** Avaliar envolver Fases 3–8 numa única `$transaction` (custo baixo com poucas queries grandes) para garantir atomicidade total da importação se isso for um requisito de negócio

- [ ] **T12** Explorar `createInstallmentPlanWithTransactions` em versão batch para grupos de parcelamento com o mesmo plano (ex.: múltiplas linhas "Notebook (x/12)" na mesma planilha)
