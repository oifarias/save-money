# Plano — Card de Total de Parcelamentos (Dashboard)

> Documento de planejamento. Nenhum código foi escrito ainda — este arquivo serve para registrar o pedido, a decisão arquitetural e o plano de implementação antes de executar.

## Contexto

O usuário pediu um novo card no Dashboard, ao lado do card "Despesas fixas", chamado **"Total de parcelamentos"**. O card mostra o somatório dos itens parcelados do mês atual, dando previsibilidade de quanto ainda falta pagar.

Regra de negócio: um lançamento é parcelado quando a descrição contém o padrão `(x/y)` — por exemplo, "Notebook (3/4)" é a parcela 3 de 4. Se em um mês foi lançado "Compra X (3/4)", no mês seguinte deve existir o lançamento equivalente "Compra X (4/4)" — a sequência avança um mês por parcela. O sistema precisa identificar esse padrão automaticamente ao criar/editar um lançamento.

## Decisão arquitetural

Duas abordagens foram avaliadas:

- **Opção A — Módulo de parcelamento separado**: entidade própria `InstallmentPlan`, cada `Transaction` parcelada referencia o plano (`installmentPlanId`, `installmentNumber`). Parcelas futuras não são materializadas como `Transaction` antes da hora — o card calcula "falta pagar" matematicamente a partir do plano.
- **Opção B — Gerar lançamentos futuros automaticamente**: ao criar `(1/3)`, o sistema já criaria `(2/3)` e `(3/3)` nos meses seguintes, no padrão do que `recurrence`/`isFixed` já fazem hoje para despesas fixas.

**Escolhida: Opção A.** A premissa da Opção B não se sustenta: hoje `recurrence`/`isFixed` (`prisma/schema.prisma`, `src/app/(app)/lancamentos/actions.ts`) são apenas flags decorativas numa única `Transaction` — não existe nenhum gerador de lançamentos futuros para reaproveitar. Construir isso do zero só para parcelamento seria mais trabalho e mais arriscado (poluiria comparativos/relatórios com transações de meses futuros que ainda não aconteceram) do que criar uma entidade de plano dedicada — que é o mesmo padrão já usado no projeto para "decisão persistida sobre um grupo de lançamentos" (`FixedExpenseInsightDecision`).

## Decisões de produto confirmadas

1. **Vínculo manual ao plano**: não terá campo manual no formulário na v1 — só detecção automática via regex. Se a descrição não bater o padrão, o lançamento fica sem plano (o usuário pode reeditar a descrição depois).
2. **Métrica do card**: mostra os dois valores — valor principal = soma das parcelas já lançadas no mês atual (mesmo padrão do card de despesas fixas); texto secundário = total que ainda falta pagar somando as parcelas futuras de todos os planos ativos.

## O que já existe no projeto (reaproveitar)

- **Padrão de entidade de decisão por grupo**: `FixedExpenseInsightDecision` é a referência direta de "registro que agrupa/decide sobre várias transações" — `InstallmentPlan` segue a mesma lógica.
- **Resolver de domínio**: `src/lib/category-resolver.ts` é o modelo de referência para `installment-resolver.ts` (função pura, chamada pela Server Action antes de persistir).
- **Cálculo de totais por mês**: `src/lib/dashboard-data.ts` já tem o padrão de agregação de `Transaction` por mês usado em `fixedExpense` — mesma lógica a estender para os planos de parcelamento.
- **Card de resumo**: `src/components/dashboard/summary-cards.tsx` já tem o card "Despesas fixas" com valor principal + texto secundário — layout a replicar para o novo card.

## O que falta criar

### 1. Schema (`prisma/schema.prisma` + migration)

```prisma
model InstallmentPlan {
  id                String   @id @default(cuid())
  userId            String
  baseDescription   String              // descrição sem o "(x/y)", ex: "Notebook"
  totalInstallments Int
  estimatedAmount   Float               // estimativa para projeção; NÃO é fonte de verdade do valor pago
  startDate         DateTime            // data projetada da parcela 1
  categoryId        String?
  subcategoryId     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([userId, baseDescription, totalInstallments])
  @@map("installment_plans")
}
```

Em `Transaction`, adicionar:

```prisma
installmentPlanId String?
installmentNumber Int?
installmentPlan   InstallmentPlan? @relation(fields: [installmentPlanId], references: [id], onDelete: SetNull)
```

Plano "ativo" é derivado (existe alguma transação vinculada com `installmentNumber < totalInstallments`), sem coluna `isActive`.

### 2. Resolver (`src/lib/installment-resolver.ts`, novo)

- Regex ancorado ao fim da descrição, por exemplo `/\((\d+)\/(\d+)\)\s*$/`, com validação (`y > 1`, `1 <= x <= y`) para evitar falsos positivos como "Conta (compartilhada)" ou "Salário (CLT)".
- `resolveInstallmentPlan(tx, userId, { description, date, amount, categoryId, subcategoryId })`:
  - extrai `baseDescription`, `installmentNumber` (x) e `totalInstallments` (y);
  - procura plano existente do usuário com mesma `baseDescription` + `totalInstallments`, cuja projeção (`startDate + (x-1) meses`) caia numa janela de tolerância da `date` informada, e que ainda não tenha uma transação ocupando esse `installmentNumber`;
  - se não achar, cria um novo `InstallmentPlan` (com `startDate` retro-calculada a partir de `date` e `x`);
  - retorna `{ installmentPlanId, installmentNumber }` ou `null` se a descrição não bater o padrão.

### 3. Server Actions (`src/app/(app)/lancamentos/actions.ts`)

- `createTransactionAction`/`updateTransactionAction` chamam o resolver antes de gravar, dentro de `prisma.$transaction` (mudança estrutural nova nessas actions — hoje não há transação de banco nelas).
- Exclusão de transação parcelada: remove só a linha; o `onDelete: SetNull` cuida do resto — não reabre nem realoca automaticamente a vaga.
- Edição de valor de uma parcela específica: altera só `Transaction.amount`; nunca propaga para `estimatedAmount` do plano (parcelas podem variar por juros/desconto).

### 4. Cálculo (`src/lib/dashboard-data.ts`)

- Valor do mês: soma das transações parceladas já lançadas no mês atual (`installmentPlanId IS NOT NULL`).
- Total restante: para cada plano ativo, `(totalInstallments - maiorInstallmentNumberLançado) × estimatedAmount`, somado entre planos.
- Exposto em `DashboardData.totals` ao lado de `fixedExpense` (nome a definir, ex.: `installments: { currentMonth, remaining }`).

### 5. UI (`src/components/dashboard/summary-cards.tsx`)

- Novo card "Total de parcelamentos" ao lado de "Despesas fixas": valor principal = soma do mês atual; texto secundário = "Faltam R$ X em Y parcelas" (ou equivalente) — mesmo padrão visual do card de despesas fixas (ícone `lucide-react`, cor dedicada para não colidir).

### 6. Backfill de dados antigos

- Script manual `scripts/backfill-installment-plans.ts` (não como `prisma migrate`), com flag `--dry-run` que imprime os agrupamentos detectados (por usuário, `baseDescription`, `totalInstallments`) antes de aplicar qualquer escrita. Idempotente — pula transações que já têm `installmentPlanId`.

### 7. Verificação

- `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- Manual: criar "Geladeira (1/6)" → plano criado, card atualiza; lançar "(2/6)" no mês seguinte com mesma descrição → vincula ao mesmo plano (não cria um segundo); editar valor de uma parcela → não altera estimativa do plano; excluir parcela do meio → plano permanece consistente, card recalcula; descrições com parênteses não relacionados (`(compartilhada)`, `(CLT)`) não geram plano falso.

## Arquivos a criar/alterar

- `prisma/schema.prisma` — modelo `InstallmentPlan` + campos novos em `Transaction` + migration.
- `src/lib/installment-resolver.ts` — novo.
- `src/app/(app)/lancamentos/actions.ts` — alterar `createTransactionAction`/`updateTransactionAction`.
- `src/lib/dashboard-data.ts` — novo cálculo de totais de parcelamento.
- `src/components/dashboard/summary-cards.tsx` — novo card.
- `scripts/backfill-installment-plans.ts` — novo.
