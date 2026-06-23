# Plano — Status de pagamento para despesas fixas

> Documento de planejamento. Nenhum código foi escrito ainda — este arquivo registra o pedido, as decisões arquiteturais e o plano de implementação antes de executar.

## Contexto

Pedido original do usuário: "Agora trabalhe nas transações que foram marcada como conta fixa, no Dashboard já deveria constar o total de contas fixas que temos pendentes de pagamento esse mês, e em lançamentos deveríamos ter uma sessão de despesas fixas com os valores certinho e que o usuário só fosse marcando como pago com a possibilidade de editar a data do pagamento e o valor. No Dashboard inicial deve apresentar o total de contas e o valor que já foi pago desse mês, para o cliente ficar mais tranquilo."

Traduzido em requisitos:
1. Dashboard: total de despesas fixas **pendentes** no mês atual.
2. Dashboard: total de despesas fixas **já pagas** no mês atual.
3. Lançamentos: seção "Despesas fixas" do mês, com valor esperado de cada uma, e ação "marcar como paga" que permite editar data de pagamento e valor (pode divergir do esperado).
4. A despesa fixa precisa "aparecer" todo mês automaticamente, sem o usuário relançar a transação base manualmente.

## O que existe hoje (investigação prévia)

- `Transaction.isFixed: Boolean @default(false)` é hoje uma flag estática sem nenhum conceito de status de pagamento — é metadado simples, usado em ~12 lugares (dashboard, lançamentos, insights, CRUD, import, validação), todos tratando como booleano isolado por transação.
- `Transaction.recurrence` (NONE/WEEKLY/MONTHLY) é puro metadado decorativo — confirmado via grep exaustivo que não existe nenhum cron/resolver que gere ocorrências futuras a partir dele.
- `Subscription { id, userId, name, amount, dueDay, isActive }` — confirmado via grep (`grep -rn "Subscription\b" src/` fora de `src/generated`) que **não é referenciado em nenhum lugar do código de aplicação**. É código morto. Também não serve de base estrutural: não tem `categoryId`, não tem matching com `Transaction`, não tem qualquer conceito de "ocorrência mensal". Decisão: **ignorar, não remover nesta entrega** (remoção é decisão de limpeza separada, fora do escopo desta feature).
- `FixedExpenseInsightDecision { id, userId, groupKey, status: accepted|dismissed, description, amount?, categoryId?, subcategoryId?, transactionIds[] }` — **é usado**, mas é um sistema paralelo e independente: vive em `src/lib/insights-data.ts` (heurística de detecção de candidatos a despesa fixa por recorrência de descrição/valor em ≥2 meses) e em `src/app/(app)/lancamentos/actions.ts` (`acceptFixedExpenseInsightAction`/`dismissFixedExpenseInsightAction`). Quando aceito, só faz `updateMany({ isFixed: true, categoryId, subcategoryId })` nas transações já existentes — não tem status de pagamento, não gera ocorrências futuras. **Não será tocado nem misturado** com a feature nova; os dois sistemas convivem (a heurística de Insights continua sugerindo "isso parece fixo", a feature nova trata o ciclo de vida de pagamento de quem já é fixo, seja por aceite da sugestão ou marcação manual).
- `isProjected` em `Transaction` **não existe** — premissa mencionada no pedido original do orquestrador que não se confirma no código. A sinergia real com parcelamento é via `InstallmentPlan` (calcula parcelas futuras matematicamente, sem persistir `Transaction` antes da hora) — é o padrão de referência usado para a decisão abaixo.
- `src/components/dashboard/summary-cards.tsx` já tem o card único "Despesas fixas" (valor + "% das despesas do mês") e o card "Total de parcelamentos" (valor do mês + texto secundário) — padrão visual de referência.
- `src/app/(app)/lancamentos/page.tsx` hoje só tem `TransactionIntake` (form de novo lançamento) + `TransactionsManager` (lista paginada/filtros) — não existe nenhuma seção de "checklist mensal".

## Decisão arquitetural principal

**Dois models novos: `FixedExpenseTemplate` (a despesa recorrente em si) e `FixedExpenseOccurrence` (a expectativa de pagamento de um template num mês específico, com status).**

Avaliei duas abordagens:

- **Opção A — Reaproveitar `Transaction.isFixed` como está, só adicionando um status na própria transação.** Mais simples, mas não resolve o requisito central: uma despesa fixa lançada uma vez não tem "instâncias" — é uma `Transaction` isolada. Não há como ter "pendente em julho" antes de uma `Transaction` de julho existir, e o pedido exige que o pendente apareça no mês **antes** do usuário lançar nada.
- **Opção B (escolhida) — Template + Occurrence, no mesmo espírito do `InstallmentPlan`.** Um `FixedExpenseTemplate` representa "aluguel, R$ 1.200, todo dia 5, categoria Moradia" — é a fonte do "valor certinho" pedido pelo usuário. Toda vez que a tela relevante carrega no mês vigente, o sistema garante (via `upsert`) que existe uma `FixedExpenseOccurrence` daquele template para aquele mês, com `status: PENDING`. Quando o usuário marca como paga, a ocorrência muda para `PAID` e — só nesse momento — uma `Transaction` real é criada (para entrar nos relatórios/comparativos normalmente).

Por que não generalizar e reaproveitar `InstallmentPlan` para isso: parcelamento é finito (N parcelas, termina) e despesa fixa é recorrente indefinidamente (sem fim previsto) — são ciclos de vida diferentes (`totalInstallments` não tem equivalente natural numa despesa fixa) e forçar o mesmo model exigiria campos nullable/condicionais que confundiriam os dois conceitos. Manter modelos separados, ainda que estruturalmente parecidos, é mais simples de raciocinar e de consultar.

### Schema proposto

```prisma
enum FixedExpenseStatus {
  PENDING
  PAID
}

model FixedExpenseTemplate {
  id             String   @id @default(cuid())
  userId         String
  description    String
  expectedAmount Float
  dueDay         Int                  // dia do mês esperado de pagamento, 1-31
  categoryId     String?
  subcategoryId  String?
  isActive       Boolean  @default(true)   // permite "pausar" sem apagar histórico/ocorrências passadas
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user        User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    Category?                @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  subcategory Category?                @relation(fields: [subcategoryId], references: [id], onDelete: SetNull)
  occurrences FixedExpenseOccurrence[]

  @@index([userId, isActive])
  @@map("fixed_expense_templates")
}

model FixedExpenseOccurrence {
  id             String             @id @default(cuid())
  templateId     String
  userId         String             // redundante com template.userId — defesa em profundidade contra IDOR, ver seção Segurança
  month          String             // "YYYY-MM"
  expectedAmount Float              // snapshot do template no momento da geração; não recalcula se o template mudar depois
  status         FixedExpenseStatus @default(PENDING)
  paidAmount     Float?
  paidDate       DateTime?
  transactionId  String?            @unique
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  template    FixedExpenseTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  transaction Transaction?         @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@unique([templateId, month])
  @@index([userId, month])
  @@map("fixed_expense_occurrences")
}
```

Em `User`, adicionar as relações novas (`fixedExpenseTemplates`, `fixedExpenseOccurrences`), seguindo o padrão já usado para todas as outras entidades.

### Decisões tomadas e justificativa

1. **Ocorrência é materializada de forma "lazy" (on-the-fly via upsert ao carregar a tela), não por cron/job agendado.** O projeto não tem worker/queue configurado — introduzir um agendador só para isso seria desproporcional. `upsert` com `@@unique([templateId, month])` como chave do `where` é atômico no Postgres (via `ON CONFLICT`), cobrindo corretamente a corrida de duas requisições simultâneas (ex.: duas abas abertas no mesmo mês) sem precisar de `$transaction` explícita nesse passo. Risco descartado pelo backend: nunca fazer "ler ocorrências existentes, depois `create` condicional" — sempre `upsert` direto por template ativo do mês corrente.
2. **Marcar como paga cria uma `Transaction` real**, em vez de a ocorrência ser uma entidade puramente paralela que nunca toca a tabela de transações. Justificativa: o usuário pediu que isso refletisse nos relatórios normais de gasto do mês (comparativo, insights, dashboard de categorias) — duplicar essa lógica de agregação fora de `Transaction` seria retrabalho e risco de inconsistência. A `Transaction` criada tem `isFixed: true` e fica vinculada via `FixedExpenseOccurrence.transactionId`.
3. **`expectedAmount` é um snapshot por ocorrência, não uma referência dinâmica ao template.** Segue exatamente o mesmo princípio já usado em `InstallmentPlan.estimatedAmount` (não recalcula histórico se a estimativa mudar) — se o usuário reajustar o valor esperado do aluguel em agosto, julho não deve mudar retroativamente.
4. **`userId` redundante em `FixedExpenseOccurrence`** (já existe via `template.userId`): mantido por decisão de segurança (defesa em profundidade contra IDOR — ver seção Segurança), não só performance de índice.
5. **Despesas fixas "antigas"** (já lançadas como `Transaction` simples com `isFixed: true`, sem nenhum template) **não migram automaticamente**. Convivem os dois conceitos: uma transação isolada marcada como fixa continua existindo e contando nos totais "fixos" do jeito que já funciona hoje; só passa a ter status de pagamento por mês quando o usuário formalizar um `FixedExpenseTemplate` para ela. Migração/sugestão automática de "essa despesa parece ser a mesma recorrente, quer transformar em template?" é melhoria futura, fora do escopo desta v1 (ver Decisões abertas).
6. **Matching entre "aluguel de junho" e "aluguel de julho"**: não é heurístico (sem ambiguidade de descrição/categoria/valor parecidos) — é estrutural, via `templateId` explícito. O usuário cria o template uma vez; toda ocorrência subsequente referencia o mesmo `templateId`. Resolve de forma definitiva o edge case "como o sistema sabe que são a mesma despesa" mencionado no pedido original — não há adivinhação.
7. **Desmarcar/desativar template (`isActive: false`)**: ocorrências já geradas (passadas) não são apagadas nem alteradas — preserva histórico. Nenhuma ocorrência nova é gerada para meses futuros enquanto `isActive: false`. Não há "exclusão" de template nesta v1, só desativação — apagar definitivamente um template com ocorrências pagas (que têm `Transaction` reais vinculadas) abriria um caso de borda desnecessário; desativar é suficiente e reversível.
8. **Exclusão da `Transaction` vinculada a uma ocorrência paga**, pela tela normal de Lançamentos: a FK usa `onDelete: SetNull` (zera só o ponteiro), mas isso por si só deixaria a ocorrência com `status: PAID` e `transactionId: null` (estado inconsistente). `deleteTransactionAction` precisa, dentro da mesma `prisma.$transaction`, fazer `updateMany({ where: { transactionId: id, userId }, data: { status: PENDING, transactionId: null, paidAmount: null, paidDate: null } })` antes/junto do delete — reabrindo a ocorrência como pendente automaticamente. Validado com backend como ajuste obrigatório, não opcional.

## Decisões abertas — genuínas pendências de produto (revisar com o usuário antes de implementar)

1. **Como o usuário cria um `FixedExpenseTemplate`?** Duas vias possíveis e não mutuamente exclusivas: (a) formulário dedicado na nova seção "Despesas fixas" ("Cadastrar despesa fixa": descrição, valor esperado, dia do mês, categoria); (b) ação "tornar despesa fixa recorrente" a partir de uma `Transaction` já existente marcada com `isFixed: true` (reaproveitando descrição/valor/categoria dela como ponto de partida do template). Recomendo implementar (a) na v1 por ser mais simples e direto, e considerar (b) como atalho de conveniência numa iteração seguinte — mas a decisão de ter ou não esse atalho já na v1 é do usuário/produto.
2. **O que acontece com a flag antiga `Transaction.isFixed` daqui para frente?** Ela continua existindo e sendo usada como está hoje (cards antigos, insights de heurística) — a feature nova não a substitui, é aditiva. Confirmar com o usuário se isso pode gerar confusão (duas formas de "ser fixo" coexistindo: a flag simples de sempre, e o novo template com ciclo de vida). Sugestão: deixar claro na UI que a nova seção é só para despesas fixas com **template cadastrado**; transações soltas com `isFixed: true` sem template continuam aparecendo nos lugares de sempre (cards de "% despesas fixas", heurística de insights) mas não entram na nova checklist mensal de pendente/pago.
3. **Limite/teto de valor e data no pagamento informado pelo usuário**: recomendo validar `paidAmount > 0` e `paidDate` dentro de uma janela razoável (não no futuro distante, não em mês diferente do mês da ocorrência) — mas o range exato ("pode pagar com X dias de atraso/antecedência?") é decisão de produto, não técnica. Proposta default no plano: `paidDate` pode ser qualquer data do mês da ocorrência ou até alguns dias após o fim do mês (pagamento atrasado é realista); não pode ser anterior ao primeiro dia do mês da ocorrência nem posterior à data atual.

---

## Plano por especialista

### Backend

**Arquivos a criar/alterar:**
- `prisma/schema.prisma` — novos models `FixedExpenseTemplate`, `FixedExpenseOccurrence`, enum `FixedExpenseStatus`, relações em `User` e `Transaction` (relação inversa opcional `fixedExpenseOccurrence FixedExpenseOccurrence?`), migration.
- `src/lib/validations/fixed-expense.ts` (novo) — `fixedExpenseTemplateSchema` (description, expectedAmount > 0, dueDay 1-31, categoryId?, subcategoryId?) e `markFixedExpensePaidSchema` (occurrenceId, paidAmount > 0, paidDate dentro da janela definida na "Decisão aberta 3").
- `src/lib/fixed-expense-data.ts` (novo) — função `ensureCurrentMonthOccurrences(userId)`: busca templates ativos do usuário, `upsert` de `FixedExpenseOccurrence` para o mês vigente de cada um (chave `@@unique([templateId, month])` no `where`), retorna as ocorrências do mês com dados do template (`description`, `categoryId` etc. via `include`). Chamada no carregamento da página de Lançamentos.
- `src/app/(app)/lancamentos/fixed-expense-actions.ts` (novo arquivo de actions, para não inflar ainda mais `actions.ts`):
  - `createFixedExpenseTemplateAction(prev, formData)` — valida com Zod, `resolveCategoryAndSubcategory`, cria o template.
  - `updateFixedExpenseTemplateAction` / `deactivateFixedExpenseTemplateAction` — edição e desativação (não há exclusão física na v1, conforme decisão 7).
  - `markFixedExpenseOccurrencePaidAction(prev, formData)` — recebe `occurrenceId`, `paidAmount`, `paidDate`. Dentro de `prisma.$transaction`: (1) `findFirst({ where: { id: occurrenceId, userId } })` da ocorrência **dentro** da transaction (evita TOCTOU, ver Segurança); (2) resolve `accountId` via `getDefaultAccountId(userId, tx)`; (3) cria a `Transaction` real (`isFixed: true`, `amount: paidAmount`, `date: paidDate`, `description`/`categoryId`/`subcategoryId` herdados do template); (4) atualiza a ocorrência (`status: PAID`, `paidAmount`, `paidDate`, `transactionId`). Chama `invalidateAggregateCaches(userId)` ao final.
  - `reopenFixedExpenseOccurrenceAction` (opcional, para o usuário desfazer um "marcar como pago" por engano) — reverte status sem apagar a `Transaction` automaticamente (ou apaga a `Transaction` vinculada também, a decidir na revisão — comportamento mais seguro é exigir que o usuário exclua a `Transaction` pela tela normal, que já reabre a ocorrência conforme decisão 8, evitando duplicar o caminho de "desfazer").
- `src/app/(app)/lancamentos/actions.ts` — ajustar `deleteTransactionAction`: dentro da `prisma.$transaction` já usada, antes do `delete`, fazer o `updateMany` que reabre a ocorrência (decisão 8). Ajustar `invalidateAggregateCaches` (sem mudança de assinatura, já cobre os casos novos).
- `src/lib/dashboard-data.ts` — nova agregação: para o mês vigente, somar `FixedExpenseOccurrence` por `status` (`pendingTotal`, `paidTotal`), tipado em `DashboardData.totals.fixedExpense` (ver decisão de UI abaixo sobre substituir ou estender o campo existente — manter compatibilidade: `fixedExpense` total atual continua existindo a partir de `Transaction.isFixed`, e um novo campo `fixedExpenseStatus: { pending, paid }` é adicionado a partir das ocorrências).
- `src/lib/transactions-query.ts` / `lancamentos/page.tsx` — expor `ensureCurrentMonthOccurrences(userId)` e passar a lista de ocorrências do mês para a nova seção de UI.

**Riscos identificados e mitigados (validado com agente backend):**
- Materialização lazy via `upsert` direto (nunca `findMany` + `create` condicional) elimina a race condition de duas requisições simultâneas.
- `accountId` da `Transaction` de pagamento deve ser resolvido no servidor via `getDefaultAccountId`, nunca aceito do client.
- `onDelete: SetNull` na FK de `transactionId` não é suficiente isolado — `deleteTransactionAction` precisa reabrir a ocorrência explicitamente (decisão 8, tratada como obrigatória).
- Todas as caches relevantes (`dashboardCacheTag`, `comparativeCacheTag`, `insightsCacheTag`) devem ser invalidadas em: criar/editar/desativar template, marcar como paga, excluir transação vinculada.

### Segurança

**Pontos confirmados pelo agente de segurança e incorporados ao plano:**
- Toda mutação que recebe `templateId`/`occurrenceId` do client usa `findFirst({ where: { id, userId } })`, nunca `findUnique({ id })` puro nem confia em join implícito via `templateId -> userId` sem repetir o filtro de `userId` na própria query da entidade mutada. `userId` redundante em `FixedExpenseOccurrence` existe justamente para permitir esse filtro direto.
- O `findFirst` de verificação de propriedade da ocorrência, na action de "marcar como paga", deve ocorrer **dentro** da mesma `prisma.$transaction` que cria a `Transaction` e atualiza o status — evita TOCTOU (checar fora e mutar dentro permite uma janela de corrida).
- `paidAmount` e `paidDate` recebidos do client passam por Zod antes de qualquer escrita: valor positivo (com teto de sanidade, ex. não aceitar valores absurdamente fora de escala — definir um limite alto razoável, não bloqueante para uso real), data dentro da janela definida na decisão aberta 3.
- Erros de "ocorrência não encontrada" e "ocorrência de outro usuário" retornam a mesma mensagem genérica (`ActionResult` de erro), nunca dois caminhos de mensagem distintos — evita enumeração/IDOR por diferença de resposta.

### Frontend

**Arquivos a criar/alterar:**
- `src/components/transactions/fixed-expenses-section.tsx` (novo) — bloco de largura cheia, posicionado em `lancamentos/page.tsx` entre `TransactionIntake` e `TransactionsManager` (ou acima de ambos, a definir no detalhamento visual), estilo `Card` com lista interna própria (não reaproveita `TransactionRow`/`transaction-list.tsx` — é uma seção de checklist mensal, sem paginação/filtros/seleção em lote, ordenada por `dueDay`). Cada item mostra: descrição, categoria, valor esperado, badge de status textual (não só cor) — `Clock`/`CircleDashed` + tom neutro/accent para "Pendente", `CheckCircle2` + `--color-success` para "Paga". Evitar reaproveitar ícones que já têm significado fixado (`ArrowUpRight` = despesa lançada).
- `src/components/transactions/fixed-expense-form.tsx` (novo) — formulário de criar/editar template (`description`, `expectedAmount`, `dueDay`, categoria/subcategoria, reaproveitando o seletor de categoria já usado em `transaction-form.tsx`).
- `src/components/transactions/mark-fixed-expense-paid-modal.tsx` (novo) — modal (reaproveitando `Modal` de `src/components/ui/*`), não edição inline: campos `paidDate` (pré-preenchido com a data atual) e `paidAmount` (pré-preenchido com `expectedAmount`), `useActionState` + `ActionResult` no mesmo padrão de todo o resto do app. Modal é a escolha certa aqui porque a ação tem 2 campos e um efeito colateral importante (gera uma `Transaction` real) — inline quebraria o padrão atual (não há precedente de inline-edit em nenhuma row existente) e tornaria a transição de estado menos explícita.
- `src/components/dashboard/summary-cards.tsx` — o card único "Despesas fixas" passa a ter, no texto secundário, os dois números lado a lado (ex.: "R$X pendente · R$Y pago este mês"), no mesmo padrão já usado pelo card "Total de parcelamentos" (valor principal + detalhamento). **Não** criar dois cards novos: quebraria o grid `lg:grid-cols-4` e diluiria a hierarquia visual sem ganho real frente a um card já com dois números relacionados.
- Empty states a tratar explicitamente: (a) usuário sem nenhum `FixedExpenseTemplate` cadastrado — Card com CTA "Cadastrar despesa fixa", não card vazio; (b) template criado no meio do mês, ainda sem ocorrência gerada para o mês anterior — diferenciar visualmente de "nenhuma despesa fixa".
- Estados de erro: validação de `fieldErrors` exibida no próprio formulário do modal, não só toast (consistente com o resto do app); erro de concorrência (duas abas marcando a mesma ocorrência simultaneamente) deve resultar em mensagem clara, não falha silenciosa.

### Test (roteiro de verificação manual — sem framework de teste automatizado configurado)

1. **Criação de template**: cadastrar "Aluguel, R$ 1.200, dia 5" → aparece na seção de Lançamentos como pendente no mês vigente; Dashboard mostra o valor em "pendente".
2. **Lazy materialization**: criar um segundo template no meio do mês → ocorrência do mês vigente aparece imediatamente ao recarregar a tela (sem esperar virar o mês); abrir a tela em duas abas simultâneas não duplica a ocorrência (unique constraint).
3. **Marcar como paga com valor/data divergentes**: marcar "Aluguel" como pago com valor diferente do esperado (ex.: conta de luz variável) e data diferente do dia esperado → ocorrência muda para "Paga", Dashboard move o valor de "pendente" para "pago" usando o **valor pago real** (não o esperado); uma `Transaction` real aparece na lista geral de Lançamentos com `isFixed: true`.
4. **Excluir a transação gerada pelo pagamento**: excluir pela tela normal de Lançamentos a `Transaction` criada no passo 3 → a ocorrência volta automaticamente para "Pendente" (sem `paidAmount`/`paidDate`/`transactionId`), Dashboard recalcula.
5. **Desativar template**: desativar um template no meio do mês → ocorrência já gerada daquele mês permanece intacta (histórico preservado); nenhuma ocorrência nova é criada para o mês seguinte.
6. **Convivência com `isFixed` legado**: uma `Transaction` antiga marcada com `isFixed: true` sem template nenhum continua contando nos cards/insights que já existiam antes desta feature, e não aparece na nova seção de checklist mensal (conforme decisão aberta 2 — confirmar com o usuário se esse comportamento é o esperado antes de fechar como "correto").
7. **Segurança**: tentar marcar como paga uma `occurrenceId` que pertence a outro usuário (via chamada direta da action, simulando manipulação client-side) → retorna erro genérico, nenhuma mutação ocorre.
8. **Caches**: após marcar como paga, Dashboard/Comparativo/Insights refletem a mudança sem precisar de reload forçado (revalidação de tags funcionando).
9. Verificação geral: `npx tsc --noEmit`, `npx eslint`, `npm run build`.

## Arquivos a criar/alterar (resumo)

- `prisma/schema.prisma` — novos models `FixedExpenseTemplate`, `FixedExpenseOccurrence`, enum `FixedExpenseStatus`, relações em `User`/`Transaction`, migration.
- `src/lib/validations/fixed-expense.ts` — novo.
- `src/lib/fixed-expense-data.ts` — novo (`ensureCurrentMonthOccurrences`).
- `src/app/(app)/lancamentos/fixed-expense-actions.ts` — novo.
- `src/app/(app)/lancamentos/actions.ts` — ajustar `deleteTransactionAction`.
- `src/lib/dashboard-data.ts` — novo campo `fixedExpenseStatus: { pending, paid }`.
- `src/app/(app)/lancamentos/page.tsx` — carregar ocorrências do mês e renderizar a nova seção.
- `src/components/transactions/fixed-expenses-section.tsx` — novo.
- `src/components/transactions/fixed-expense-form.tsx` — novo.
- `src/components/transactions/mark-fixed-expense-paid-modal.tsx` — novo.
- `src/components/dashboard/summary-cards.tsx` — estender card "Despesas fixas" com pendente/pago.
