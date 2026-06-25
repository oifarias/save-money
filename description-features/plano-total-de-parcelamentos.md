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

> **Atualização (2026-06-24): decisão revertida para Opção B, a pedido explícito do usuário.** O usuário pediu uma nova flag no formulário de criação de despesa ("esta despesa é parcelada?" + quantidade de parcelas) que já materializa as N transações de uma vez, replicando categoria/sub-categoria/hashtags da parcela 1, com exclusão e edição em cascata entre todas as parcelas do mesmo plano. A detecção automática via regex `(x/y)` descrita nesta seção foi mantida como fallback (continua funcionando para quem digitar a descrição manualmente), mas o caminho principal de criação passou a ser a flag explícita. Ver `src/lib/installment-resolver.ts` (`createInstallmentPlanWithTransactions`, `deleteInstallmentPlanCascade`, `propagateInstallmentEdit`) e `src/app/(app)/lancamentos/actions.ts`.

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

---

# Plano — Insights de previsibilidade de parcelamentos

> Extensão da feature de parcelamentos. Documento de planejamento — nenhum código foi escrito ainda.

## Contexto

Hoje o Dashboard mostra "quanto falta pagar no total" (`totals.installments.remaining`), mas é uma soma agregada — não diz *quando* cada parcelamento específico termina. O usuário quer, na tela de Insights, um cartão que liste cada `InstallmentPlan` ativo do usuário com a previsão de término, no formato "Notebook termina em dezembro/2026, faltam 3 parcelas de R$ 350,00".

Esse insight é puramente derivado do `InstallmentPlan` (não depende de detecção estatística como os candidatos a despesa fixa) — é o tipo de insight mais simples e mais confiável do módulo, porque a informação (`startDate`, `totalInstallments`, `estimatedAmount`) já está 100% estruturada.

## Decisão

Adicionar um novo insight **estruturado** (não é uma sugestão que o usuário aceita/descarta, como os candidatos a despesa fixa — é um fato direto sobre dados que o usuário já confirmou ao lançar as parcelas). Por isso não precisa de tabela de decisão (`*Decision`) nem de fluxo de aceitar/descartar: é só leitura e exibição, no mesmo espírito do "Alerta de despesas fixas acima de 50%" (`fixedExpenseAlert`), que também é calculado e mostrado direto, sem interação do usuário.

## O que já existe (reaproveitar)

- **Padrão de módulo de insights**: `src/lib/insights-data.ts` exporta `getInsightsPageData(userId)`, cacheado via `unstable_cache(..., { tags: [insightsCacheTag(userId)], revalidate: 60 })`. Cada "tipo de insight" é um campo tipado em `InsightsPageData` (`categoryGrowth`, `fixedExpenseAlert`, `hashtagRanking` etc.), calculado dentro de `getInsightsPageDataUncached` e devolvido junto no mesmo objeto — o novo insight (`installmentForecasts`) segue exatamente esse padrão, mais um campo no mesmo retorno.
- **Renderização em cards**: `src/app/(app)/insights/page.tsx` monta um grid (`grid-cols-1 lg:grid-cols-2`) de cards, um componente por tipo de insight, todos importados de `src/components/insights/insight-sections.tsx` (ex.: `GrowthRankingCard`, `FixedExpenseAlertCard`). Insights sem dados mostram `EmptySection` com mensagem orientativa, em vez de esconder o card — mesmo padrão a seguir.
- **Helpers de data já usados no resolver**: `addMonths` (presente tanto em `insights-data.ts` quanto em `installment-resolver.ts`) e `monthLabel` (`src/lib/format.ts`, já usado em `windowLabel`/`growthWindowLabel`) cobrem tudo que esse insight precisa para calcular e formatar o mês de término.
- **Fonte de dados**: `InstallmentPlan` + `Transaction.installmentNumber`/`installmentPlanId`, já existentes pelo plano anterior.

## O que falta criar

### 1. Cálculo (`src/lib/insights-data.ts`)

- Nova query dentro de `getInsightsPageDataUncached`: buscar todos os `InstallmentPlan` do usuário com suas `transactions` (`select: { installmentNumber: true }`), em paralelo com as queries já existentes (`Promise.all`).
- Plano é considerado **ativo** com a mesma regra já definida no plano anterior: existe transação vinculada com `installmentNumber < totalInstallments` (ou, se não houver nenhuma transação ainda, ele tem `totalInstallments` parcelas todas pendentes — também é "ativo"). Planos totalmente concluídos (`maiorInstallmentNumberLançado === totalInstallments`) são filtrados fora do insight.
- Para cada plano ativo:
  - `lastLaunchedInstallment` = maior `installmentNumber` já lançado (ou `0` se nenhuma parcela foi lançada ainda);
  - `remainingInstallments` = `totalInstallments - lastLaunchedInstallment`;
  - `endDate` = projeção da última parcela = `addMonths(startDate, totalInstallments - 1)`;
  - `endMonthLabel` = `monthLabel(endDate)` (reaproveita o helper já usado nas outras seções, formato "dezembro/2026" — confirmar o formato exato olhando `src/lib/format.ts`, mas o objetivo é não reinventar formatação de mês);
  - `remainingAmount` = `remainingInstallments * estimatedAmount` (mesma fórmula do card do Dashboard, para os dois números nunca divergirem).
- Ordenação sugerida: planos que terminam mais perto primeiro (`endDate` ascendente) — é a informação mais "atuável" para o usuário.
- Novo tipo exportado:

```ts
export type InstallmentForecast = {
  planId: string;
  baseDescription: string;
  categoryName: string | null;
  remainingInstallments: number;
  totalInstallments: number;
  estimatedAmount: number;
  remainingAmount: number;
  endMonthLabel: string;
};
```

- Acrescentar `installmentForecasts: InstallmentForecast[]` em `InsightsPageData` e no retorno de `getInsightsPageDataUncached`.

### 2. UI (`src/components/insights/insight-sections.tsx` + `src/app/(app)/insights/page.tsx`)

- Novo componente `InstallmentForecastCard({ data }: { data: InstallmentForecast[] })`, mesmo estilo visual dos outros cards (`Card`, título `font-display text-base font-semibold`, `EmptySection` quando `data.length === 0` com mensagem tipo "Você não tem parcelamentos em andamento").
- Cada item da lista: descrição (`baseDescription`), badge/texto com categoria (se houver), e a frase central no formato pedido: **"termina em {endMonthLabel}, faltam {remainingInstallments} parcelas de {formatCurrency(estimatedAmount)}"**. Quando `remainingInstallments === 1`, ajustar o texto para singular ("falta 1 parcela de...") para não ficar gramaticalmente estranho.
- Posicionamento no grid de `insights/page.tsx`: ao lado do `FixedExpenseAlertCard` (mesma natureza — alerta/projeção direta, não uma sugestão a aceitar) faz mais sentido do que ao lado de `HashtagRankingCard`. Como o grid é `lg:grid-cols-2`, inserir o novo card imediatamente após `FixedExpenseAlertCard` mantém os dois "alertas de previsibilidade" próximos visualmente.

### 3. Verificação

- `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- Manual: criar plano com 2 de 4 parcelas lançadas → card mostra "faltam 2 parcelas" e o mês correto de término; lançar a 3ª parcela → contador desce para 1; lançar a última parcela → plano sai da lista (não é mais ativo); plano sem `categoryId` → card não quebra, só omite o badge de categoria; usuário sem nenhum parcelamento → `EmptySection`.

## Arquivos a criar/alterar

- `src/lib/insights-data.ts` — novo cálculo `installmentForecasts` + tipo `InstallmentForecast`.
- `src/components/insights/insight-sections.tsx` — novo componente `InstallmentForecastCard`.
- `src/app/(app)/insights/page.tsx` — inserir o novo card no grid.

## Decisões abertas (revisar com o usuário)

1. **Plano sem nenhuma parcela lançada ainda**: o resolver só cria o `InstallmentPlan` quando a primeira transação `(x/y)` é lançada — então, na prática, "plano sem nenhuma parcela lançada" não deveria existir no banco. Mantenho essa branch só defensivamente (não deve ocorrer pela forma como o resolver funciona hoje); não é uma decisão de produto pendente, é só uma nota de implementação.
2. **Formato exato do mês** ("dezembro/2026" vs "dez/2026" vs "Dezembro de 2026"): a recomendação é reaproveitar literalmente `monthLabel()` de `src/lib/format.ts` para manter consistência com o resto do app — preciso confirmar a saída exata dessa função antes de implementar, mas não é uma decisão de produto, é checagem de helper existente.
3. **Limite de itens exibidos**: outros insights truncam (`.slice(0, 5)`, `.slice(0, 3)`). Parcelamentos costumam ser poucos por usuário (tipicamente 1 a 5 simultâneos) — recomendo **não truncar** essa lista, mostrando todos os planos ativos. Se o usuário achar que pode crescer demais, dá pra revisitar.

---

# Plano — Integração de parcelamentos com Metas (orçamento comprometido)

> Extensão da feature de parcelamentos. Documento de planejamento — nenhum código foi escrito ainda.

## Contexto

Hoje, em `src/lib/budget-data.ts`, `getBudgetProgress()` calcula `spent` por categoria via `prisma.transaction.groupBy(...)` filtrando só transações **já lançadas** no mês (`date >= monthStart && date < nextMonthStart`). Isso significa que, se o usuário tem um parcelamento ativo de "Notebook (3/6)" categorizado em "Eletrônicos", o valor da parcela 3 só entra no "gasto até agora" daquela categoria no dia em que o usuário efetivamente lançar a transação `Notebook (3/6)` — mesmo que o app já saiba, desde o primeiro dia do mês, que essa parcela vai vir (ela está no `InstallmentPlan`, só falta a `Transaction` do mês ser criada).

O usuário quer que esse gasto futuro-mas-certo já apareça como "comprometido" na meta da categoria desde o início do mês, em vez de aparecer de surpresa só quando for lançado manualmente.

## Decisão

**Separar "comprometido por parcelamento" de "gasto manual lançado"** dentro do mesmo `BudgetCategoryProgress`, em vez de simplesmente somar tudo em `spent` sem distinção. Avaliei duas abordagens:

- **Opção A — Misturar tudo em `spent`**: somar a projeção da parcela do mês direto no número que já existe. Mais simples de implementar, mas esconde a origem do número: se o usuário não lançou a parcela ainda e a barra de progresso já mostra 80% gasto, ele pode achar que há um bug ou não entender de onde vem o valor.
- **Opção B — Expor `committedFromInstallments` como campo separado, somado visualmente ao lado de `spent`**: o card de progresso mostra "R$ X já lançados + R$ Y comprometidos em parcelas = R$ Z de R$ limite", preservando a rastreabilidade. É o mesmo princípio do Dashboard, que já separa "mês atual" de "restante" no card de parcelamentos — não inventa um padrão novo.

**Escolhida: Opção B.** É mais trabalho de UI, mas é a única opção que não gera confusão quando a parcela do mês ainda não foi lançada manualmente, e quando ela finalmente for lançada (a `Transaction` real entra em `spent`) — nesse momento, o comprometido daquela parcela específica precisa sair do "comprometido" para não contar em dobro. Esse deslocamento automático só funciona de forma confiável se os dois números forem mantidos visivelmente separados durante o cálculo.

## O que já existe (reaproveitar)

- **Cálculo de gasto por categoria**: `getBudgetProgress(userId, monthKey)` em `src/lib/budget-data.ts` — ponto único de cálculo de `spent`/`limitAmount` por categoria, consumido por `BudgetProgressView` (`src/components/goals/budget-progress-view.tsx`). É o lugar natural para adicionar o comprometido.
- **`InstallmentPlan.categoryId`**: já existe no schema do plano anterior — é exatamente o vínculo que esta integração precisa (plano → categoria → bucket/meta).
- **Sugestão de valor padrão da meta**: `CategoryBudgetStep` (`src/components/goals/category-budget-step.tsx`) já calcula um valor sugerido por categoria a partir de `categoryAverages` (média histórica) — é o ponto de entrada natural para também considerar o parcelamento ativo na sugestão inicial da meta (ver seção 2 abaixo).
- **Barra de progresso por categoria**: `BudgetProgressView` já tem a barra com estados visuais (`isOver`, `isNear`) — só precisa de um segmento/segunda informação para o comprometido.

## O que falta criar

### 1. Cálculo do valor comprometido (`src/lib/budget-data.ts`)

- Nova função `getInstallmentCommitmentsByCategory(userId, monthKey)`: busca `InstallmentPlan` ativos do usuário com `categoryId IS NOT NULL`, com suas `transactions` (`select: { installmentNumber: true, date: true }`).
- Para cada plano, calcula a parcela **projetada para o mês `monthKey`** (mesma lógica de projeção do `installment-resolver.ts`: `installmentNumber` correspondente a `monthKey` é `diffInMonths(monthKey, startDate) + 1`).
- Se já existe uma `Transaction` real lançada para aquele `installmentNumber` **dentro do próprio `monthKey`**, o comprometido daquele plano para aquele mês é `0` (já está contado em `spent` — não soma duas vezes).
- Se não existe, soma `estimatedAmount` no comprometido da categoria daquele plano.
- Retorna `Map<categoryId, number>` (comprometido por categoria, só para o mês perguntado).
- `getBudgetProgress` passa a chamar essa função em paralelo (`Promise.all` junto com `spentRows`/`incomeRow`) e adiciona `committed: number` em cada `BudgetCategoryProgress`, mais `necessidade.committed`/`desejo.committed` agregados do mesmo jeito que `sumBucket` já agrega `spent`/`limit`.

```ts
export type BudgetCategoryProgress = {
  // ...campos existentes
  committed: number; // valor projetado de parcelas ainda não lançadas neste mês
};
```

### 2. UI — barra de progresso (`src/components/goals/budget-progress-view.tsx`)

- A barra de cada categoria passa a ter dois segmentos: o já existente (`spent`, cor normal) e um novo segmento hachurado/com opacidade reduzida para `committed`, empilhado depois do primeiro — visual de "isso aqui já era esperado, vai vir".
- Texto ao lado da barra: hoje é `formatCurrency(spent)` de `formatCurrency(limitAmount)`; passa a ser `formatCurrency(spent)} + {formatCurrency(committed)}` quando `committed > 0`, mantendo o "de {limitAmount}" no final. Pequeno texto auxiliar abaixo, ex.: "inclui parcela de Notebook (3/6) ainda não lançada" — reaproveita `baseDescription` do plano para dar contexto, em vez de só mostrar um número sem explicação.
- `share` (percentual da barra) passa a considerar `(spent + committed) / limitAmount`, então `isOver`/`isNear` já refletem o comprometido — é exatamente o comportamento que o usuário pediu ("a meta nasce comprometida").

### 3. Sugestão de valor da meta no wizard (`src/components/goals/category-budget-step.tsx` + dados que alimentam o wizard)

- Ao computar `computeDefaultAmounts`, se a categoria tem parcelamento ativo, o valor sugerido da meta deveria no mínimo cobrir o comprometido do mês (`max(sugestão por média histórica, comprometido do parcelamento)`), para não nascer uma meta menor que o gasto já garantido.
- Isso exige passar `committedByCategory: Record<string, number>` como nova prop pro `CategoryBudgetStep`, calculado no componente pai (`goals-wizard.tsx` ou na página `metas/page.tsx`, que hoje provavelmente já carrega `categoryAverages` da mesma forma) usando a mesma `getInstallmentCommitmentsByCategory`.

### 4. Server Action — validação (`src/app/(app)/metas/actions.ts`)

- `saveBudgetAllocationAction` hoje aceita qualquer `limitAmount >= 0` informado pelo usuário (validado só por `budgetAllocationSchema`, sem cruzar com parcelamentos). Não vou bloquear o salvamento se o usuário definir uma meta manual menor que o comprometido (isso é decisão de produto — ver "Decisões abertas" abaixo) — mas a tela precisa **avisar** visualmente quando isso acontece (`limitAmount < committed`), reaproveitando o mesmo estado visual de "acima do esperado" que `overTarget` já usa em `CategoryBudgetStep`.

### 5. Verificação

- `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- Manual: criar parcelamento ativo numa categoria com meta definida → barra da categoria mostra comprometido mesmo sem nenhum lançamento manual no mês; lançar a parcela do mês manualmente → comprometido daquele plano zera e o valor migra para `spent` sem somar duplicado; categoria sem meta definida (`Budget` inexistente) → parcelamento nela não aparece em lugar nenhum da tela de metas (categoria não está no wizard) — confirmar que isso é aceitável ou se deve forçar a categoria a aparecer mesmo sem meta definida (ver decisões abertas); plano com `categoryId = null` → não afeta nenhuma meta, segue só no Dashboard/Insights.

## Arquivos a criar/alterar

- `src/lib/budget-data.ts` — nova função `getInstallmentCommitmentsByCategory`, campo `committed` em `BudgetCategoryProgress`/`necessidade`/`desejo`.
- `src/components/goals/budget-progress-view.tsx` — segmento visual de comprometido na barra + texto auxiliar.
- `src/components/goals/category-budget-step.tsx` — sugestão mínima de meta considerando comprometido.
- `src/app/(app)/metas/page.tsx` (ou onde o wizard busca dados) — calcular e passar `committedByCategory`.
- `src/app/(app)/metas/actions.ts` — aviso (não bloqueio) quando `limitAmount` informado for menor que o comprometido.

## Decisões abertas — confirmadas pelo usuário

1. **Categoria do plano de parcelamento é nula (`InstallmentPlan.categoryId = null`)**: **confirmado — não participa da integração com Metas.** Fica só no Dashboard e nos Insights; não força o usuário a categorizar retroativamente, e não há aviso sugerindo categorizar (fora do escopo da v1).
2. **Valor real da parcela diverge da estimativa (`estimatedAmount`)**: **confirmado — mantém a estimativa original.** As projeções futuras (Insights e comprometido em Metas) continuam usando `estimatedAmount` do plano, sem recalcular pela última parcela paga. Consistente com a decisão já tomada no plano original ("nunca propaga para `estimatedAmount` do plano").
3. **Meta editada manualmente já é menor que o valor comprometido pela parcela**: **confirmado — permite e avisa, não bloqueia.** A Server Action `saveBudgetAllocationAction` salva normalmente; a UI mostra aviso visual (mesmo estado `overTarget`/`isOver` já usado) quando `limitAmount < committed`.
4. **Categoria com parcelamento ativo mas sem meta (`Budget`) definida no mês**: **confirmado — fica para depois.** Por ora, uma categoria sem `Budget` criado no mês continua invisível em `BudgetProgressView`, mesmo com parcelamento ativo (aparece só no Dashboard/Insights). Detectar isso e sugerir proativamente a criação da meta é melhoria futura, fora do escopo desta v1.
5. **Quando a última parcela é paga e o plano "termina" no meio do mês de competência das metas**: sem decisão pendente — é consequência direta do cálculo "ativo = tem parcela pendente": a partir do mês seguinte ao término, `getInstallmentCommitmentsByCategory` não encontra mais plano ativo e o comprometido zera naturalmente.
