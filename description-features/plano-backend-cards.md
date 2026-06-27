# Plano: gaps entre backend e novos cards do dashboard

Data da análise: 2026-06-26  
Arquivos analisados:
- `src/lib/dashboard-data.ts`
- `src/components/dashboard/summary-cards.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/lancamentos/page.tsx`
- `src/components/transactions/transactions-manager.tsx`
- `src/lib/fixed-expenses-data.ts`

---

## Diagnóstico por card

### Card Entradas do mês

| Campo | Status | Fonte |
|---|---|---|
| Total de entradas | ✅ implementado | `DashboardData.totals.income` |
| Entrada fixa — valor | ✅ implementado | `IncomeBreakdown.fixedTotal` |
| Entrada fixa — contagem | ✅ implementado | `IncomeBreakdown.fixedCount` |
| Entrada variável — valor | ✅ implementado | `IncomeBreakdown.variableTotal` |
| Entrada variável — contagem | ✅ implementado | `IncomeBreakdown.variableCount` |

Rastreamento completo:

1. **Query** (`dashboard-data.ts`, linha 113): `prisma.transaction.groupBy({ by: ["type", "isFixed"], ... })` agrupa por tipo e flag `isFixed` numa só query. O loop nas linhas 154–176 distribui os resultados nos campos de `incomeBreakdown`.
2. **Tipo** exportado: `IncomeBreakdown` (`dashboard-data.ts`, linha 46).
3. **Prop do componente** (`summary-cards.tsx`, linha 17): `incomeBreakdown: IncomeBreakdown`.
4. **Renderização** (`summary-cards.tsx`, linhas 140–141): `fixedCount` e `variableCount` aparecem no label; `fixedTotal`/`variableTotal` são os valores monetários.
5. **Dashboard page** (`dashboard/page.tsx`, linha 79): passa `dashboardData.totals.incomeBreakdown` corretamente.
6. **Lancamentos page** (`lancamentos/page.tsx`, linhas 45–74): recalcula `incomeBreakdown` via `incomeBreakdownRows` (groupBy isFixed filtrado por tipo INCOME) e passa via `summary.incomeBreakdown`.

**Sem gaps.**

---

### Card Despesas do mês

| Campo | Status | Fonte |
|---|---|---|
| Total de despesas | ✅ implementado | `DashboardData.totals.expense` |
| Saída fixa — valor | ✅ implementado | `ExpenseBreakdown.fixedTotal` |
| Saída fixa — contagem | ✅ implementado | `ExpenseBreakdown.fixedCount` |
| Saída variável — valor | ✅ implementado | `ExpenseBreakdown.variableTotal` |
| Saída variável — contagem | ✅ implementado | `ExpenseBreakdown.variableCount` |

Rastreamento idêntico ao de entradas, usando o mesmo `groupBy` (linhas 113 e 154–176 de `dashboard-data.ts`), tipo `ExpenseBreakdown` (linha 53) e prop `expenseBreakdown` em `SummaryCards`.

**Sem gaps.**

---

### Card Total de parcelamentos

| Campo | Status | Fonte |
|---|---|---|
| Total do mês atual — valor | ✅ implementado | `InstallmentTotals.currentMonth` |
| Pendentes — contagem (`currentMonthCount`) | ✅ implementado | `InstallmentTotals.currentMonthCount` |
| Última parcela — contagem (`lastInstallmentPlansCount`) | ✅ implementado | `InstallmentTotals.lastInstallmentPlansCount` |

Rastreamento:

1. **Query de totais do mês** (`dashboard-data.ts`, linha 134): `prisma.transaction.aggregate` filtra `installmentPlanId: { not: null }` dentro do intervalo do mês. Produz `currentMonth` (soma) e `currentMonthCount` (contagem).
2. **Query de planos** (`dashboard-data.ts`, linha 139): `prisma.installmentPlan.findMany` com seleção de `totalInstallments` e transações. O loop nas linhas 207–223 calcula `lastInstallmentPlansCount`.
3. **Tipo** exportado: `InstallmentTotals` (`dashboard-data.ts`, linha 39).
4. **Prop do componente** (`summary-cards.tsx`, linha 10): `installments: { currentMonth, currentMonthCount, remaining, lastInstallmentPlansCount }`.
5. **Renderização** (`summary-cards.tsx`, linhas 153–163): `currentMonthCount` no label de "Pendentes", `lastInstallmentPlansCount` no label e valor de "Última parcela".
6. **Dashboard page** (`dashboard/page.tsx`, linha 76): passa `dashboardData.totals.installments` corretamente.

**No dashboard: sem gaps.**

**Na página /lancamentos: gap real (ver Observações).**

---

### Card Despesas fixas (mês)

| Campo | Status | Fonte |
|---|---|---|
| Total (pendente + pago) | ✅ implementado | `fixedExpenseTemplates.pendingTotal + paidTotal` |
| Pendente — valor | ✅ implementado | `FixedExpenseTemplatesTotals.pendingTotal` |
| Pendente — contagem | ✅ implementado | `FixedExpenseTemplatesTotals.pendingCount` |
| Pago — valor | ✅ implementado | `FixedExpenseTemplatesTotals.paidTotal` |
| Pago — contagem | ✅ implementado | `FixedExpenseTemplatesTotals.paidCount` |

Rastreamento:

1. **Query** (`dashboard-data.ts`, linha 147): `getFixedExpensesChecklist(userId, monthKeyOf(monthStart))` retorna `FixedExpenseChecklistItem[]`.
2. **Acumulação** (`dashboard-data.ts`, linhas 182–199): loop sobre o checklist distribui `paidAmount` e `expectedAmount` nos quatro campos.
3. **Tipo** exportado: `FixedExpenseTemplatesTotals` (`dashboard-data.ts`, linha 60).
4. **Prop do componente** (`summary-cards.tsx`, linha 16): `fixedExpenseTemplates: FixedExpenseTemplatesTotals`.
5. **Renderização** (`summary-cards.tsx`, linhas 130, 165–171): `fixedExpenseTotal` (total) calculado no componente; `pendingCount`/`paidCount` nos labels; `pendingTotal`/`paidTotal` como valores.
6. **Dashboard page** (`dashboard/page.tsx`, linha 78): passa `dashboardData.totals.fixedExpenseTemplates` corretamente.
7. **Lancamentos page** (`lancamentos/page.tsx`, linhas 89–101): recalcula via `fixedExpensesChecklist.reduce(...)` e passa via `summary.fixedExpenseTemplates`.

**Sem gaps.**

---

## Gaps reais encontrados

### Gap 1 — Card de parcelamentos zerado em /lancamentos (⚠️ parcialmente implementado)

**Impacto:** a página `/lancamentos` sempre exibe o card "Total de parcelamentos" com R$ 0, 0 pendentes e 0 última parcela.

**Causa raiz:** o tipo `TransactionsSummary` em `transactions-manager.tsx` (linha 26) não inclui `installments`. O `TransactionsManager` passa o valor fixo zerado para `SummaryCards`:

```tsx
// transactions-manager.tsx, linha 239
installments={{ currentMonth: 0, currentMonthCount: 0, remaining: 0, lastInstallmentPlansCount: 0 }}
```

**Decisão necessária (produto):** o card de parcelamentos em `/lancamentos` deve ser contextual ao período/filtro ativo, ou deve sempre refletir o mês corrente (igual ao dashboard)? Essa é uma decisão de produto, não técnica.

- **Opção A — Contextual ao filtro:** adicionar queries análogas às do dashboard (`prisma.transaction.aggregate` + `prisma.installmentPlan.findMany`) em `lancamentos/page.tsx`, restringidas pelo `where` atual, calcular `installments` e incluí-lo em `summary`. Adicionar `installments: InstallmentTotals` ao tipo `TransactionsSummary`.
- **Opção B — Ocultar o card em /lancamentos:** passar `undefined` para `installments` e o `SummaryCards` não renderizar aquele card quando não houver dados. Evita query extra sem contexto claro.
- **Opção C — Manter zerado (status quo):** aceitável se o card de parcelamentos for considerado irrelevante fora do dashboard.

---

### Gap 2 — "Pendentes" no card de parcelamentos exibe o mesmo valor que "Total" (⚠️ redundância de UX)

**Causa:** `summary-cards.tsx`, linha 158:
```tsx
left: { label: `Pendentes (${installments.currentMonthCount})`, value: installments.currentMonth },
```

O campo `value` de "Pendentes" usa `installments.currentMonth` — exatamente o mesmo número mostrado como "Total" no topo do card. O campo `currentMonthCount` aparece apenas no label (contagem), não há um valor monetário distinto para a linha de baixo.

**Não é um gap de dados** — os campos `currentMonth`, `currentMonthCount` e `lastInstallmentPlansCount` existem no backend. É uma questão de como o dado é apresentado: se o "left" do breakdown deveria mostrar um valor diferente (por exemplo, `installments.remaining` para dar contexto de "quanto ainda falta pagar no total"), isso exigiria apenas ajuste no `summary-cards.tsx`, sem nenhuma query nova.

---

## O que NÃO é um gap (e não precisa de implementação)

- `getFixedExpensesChecklist` é chamado sem `referenceMonth` em `lancamentos/page.tsx` e com o mês calculado em `dashboard-data.ts`. Não é inconsistência: o parâmetro tem default `currentReferenceMonth()` (`fixed-expenses-data.ts`, linha 29), produzindo o mesmo resultado.
- Dois critérios de "fixo" coexistem no projeto: `Transaction.isFixed` (base para `expenseBreakdown`) e `FixedExpenseTemplate` (base para `fixedExpenseTemplates`). Isso é uma decisão de design deliberada e está documentada nos comentários do código. Os cards usam cada fonte no contexto correto.

---

## Ordem de implementação recomendada

Nenhuma mudança de schema ou query nova é obrigatória para o dashboard funcionar — todos os dados já existem. As ações pendentes são:

1. **Decisão de produto sobre o Gap 1** (card de parcelamentos em /lancamentos). Sem essa decisão nenhum código deve ser escrito.
2. **Se Opção A for escolhida para o Gap 1:**
   a. Adicionar `installments: InstallmentTotals` ao tipo `TransactionsSummary` em `transactions-manager.tsx`.
   b. Adicionar as duas queries de parcelamentos em `lancamentos/page.tsx` (mesma lógica de `dashboard-data.ts`, linhas 134–229, adaptada ao `where` do período ativo).
   c. Passar o resultado calculado em `summary.installments`.
   d. Remover o objeto zerado fixo em `transactions-manager.tsx`.
3. **Gap 2 (redundância de UX):** se for corrigido, alterar apenas `summary-cards.tsx` para usar `installments.remaining` (ou outro campo) como `left.value` do card de parcelamentos — sem nenhuma query nova.

---

## Resumo executivo

Todos os campos exigidos pelos 4 novos cards do dashboard **já existem** nos tipos `DashboardData`, `IncomeBreakdown`, `ExpenseBreakdown`, `InstallmentTotals` e `FixedExpenseTemplatesTotals` exportados por `src/lib/dashboard-data.ts`. O `SummaryCards` os consome corretamente. A página `dashboard/page.tsx` os passa sem omissão.

O único gap real é o card de parcelamentos em `/lancamentos`, que está propositalmente zerado porque `TransactionsSummary` não carrega `installments`. Isso requer uma decisão de produto antes de qualquer implementação.
