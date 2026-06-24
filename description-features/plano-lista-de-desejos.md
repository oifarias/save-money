# Plano — Lista de Desejos (Wishlist gamificada)

> Documento de planejamento. Nenhum código foi escrito ainda — este arquivo registra a jornada, a modelagem de dados e o plano de implementação antes de executar.

## Contexto

O usuário quer um módulo novo de "Lista de Desejos": cadastro de itens que ele deseja comprar — de besteiras de valor pequeno a itens caros —, com categorização hierárquica obrigatória (`Category` pai + filho), e que o sistema eventualmente saiba indicar **quando ele "pode comprar"** o item, cruzando:

- progresso de economia específico daquele desejo (mental accounting);
- parcelamentos da mesma categoria do desejo que estão terminando (liberam capacidade de parcela nova);
- sempre respeitando o orçamento já configurado em Metas (não pode sugerir uma compra que estoure `Budget.limitAmount` da categoria).

Requisito explícito de produto: a jornada de cadastro/acompanhamento precisa ser **gamificada**, usando boas práticas de UX e economia comportamental — não é "só um CRUD com um botão marcar como comprado".

## Pesquisa: conceitos de economia comportamental aplicados

- **Mental accounting** (Thaler) — o usuário separa mentalmente "dinheiro pra essa geladeira" do resto do saldo; é o motivo de vincular um `Goal` dedicado por desejo em vez de só guardar um número solto.
- **Pre-commitment** — convidar (não forçar) o usuário a se comprometer com um plano de economia no momento do desejo, quando a motivação está mais alta, aumenta a taxa de conclusão frente a "decidir depois".
- **Framing do progresso** — foco no "quanto falta" tende a motivar mais no início da jornada (a meta parece atingível incrementalmente), enquanto foco no "quanto já tenho" motiva mais perto do fim (sensação de conquista próxima). Não é uma regra fixa e absoluta — o plano usa um framing dinâmico (gap em destaque até ~60% do progresso, acumulado em destaque depois).
- **Milestones/marcos** — celebrar 25/50/75% com reforço leve (toast/badge), não modal interruptivo, evita fadiga de gamificação.
- **Fricção saudável (cooling-off period)** — para desejos de valor alto, atraso deliberado antes de permitir "comprar agora" reduz compra por impulso, mas precisa ser visível e explicado (nunca um bloqueio silencioso) para não gerar frustração.
- **Ancoragem** — mostrar o valor estimado do item desde o cadastro, e contrastar com "quanto já tenho" ancora a percepção de progresso desde o primeiro dia.
- **Sem culpa no abandono** — desistir de um desejo é uma decisão financeira legítima (não é "falha"); o copy de abandono precisa refletir isso, inclusive na confirmação, não só no estado final.

## Decisão arquitetural

### 1. Modelagem: `Wish` novo + reaproveitamento de `Goal` (não duplicar progresso)

Avaliei duas abordagens para guardar "quanto já economizei para esse desejo":

- **Opção A — Duplicar `targetAmount`/`currentAmount` dentro do próprio `Wish`.** Mais direto de consultar, mas cria duas fontes de verdade de "progresso de economia" no sistema (uma em `Goal`, outra em `Wish`) — divergem com o tempo e duplicam toda a lógica de aporte que `Goal` já existe para resolver.
- **Opção B (escolhida) — `Wish` referencia um `Goal` opcional (`Goal.wishId`, relação 1:1 opcional).** O `Wish` guarda só o que é específico dele (categoria obrigatória, status do funil, cooling-off, vínculo de compra); o `Goal` (já existente, já usado em Metas) guarda `targetAmount`/`currentAmount`/`deadline` quando o usuário optar por ter uma estratégia de economia. Sem estratégia definida (`goalId: null`), o desejo simplesmente não tem progresso de aporte ainda — fica visível na UI como "sem plano de economia", convidando o usuário a criar um.

**Escolhida: Opção B.** Reaproveita 100% do que `Goal` já resolve (sem nenhum consumidor existente assumindo que toda `Goal` é "genérica e sem dono externo" — é uma extensão aditiva), evita duas fontes de progresso, e mantém o princípio já usado no projeto de "estender por referência, não por duplicação" (mesmo espírito de `InstallmentPlan.categoryId` sendo a única fonte de categoria de parcela, nunca copiada para `Transaction`).

### 2. "Pode comprar": derivado, não persistido

Assim como `InstallmentForecast` (insight de parcelamento) e `fixedExpenseAlert`, "pode comprar" é **calculado em tempo de leitura**, nunca uma coluna gravada no banco — evita estado obsoleto (ex.: usuário gasta a economia em outra coisa e o badge continuaria mostrando "pode comprar" se fosse persistido). A lógica cruza três fontes, todas já existentes:

1. **Economia suficiente**: `Goal.currentAmount >= Wish.estimatedAmount`, quando há `goalId` vinculado.
2. **Capacidade de parcela liberada na categoria**: reaproveita `getInstallmentCommitmentsByCategory(userId, monthKey)` (`src/lib/budget-data.ts`), chamada diretamente com o `monthKey` futuro de referência — a função já exclui planos cujo `projectedInstallmentNumber > totalInstallments`, então não é necessário comparar manualmente mês atual vs. mês seguinte; basta ler `committed` do mês futuro e comparar com o `committed` do mês atual para saber quanto se libera.
3. **Sem estourar a Meta**: calcula `headroom = Budget.limitAmount - spentEstimado - committed` da categoria do desejo no mês de referência futuro (via `getBudgetProgress` + correção abaixo); só sinaliza "pode comprar via parcela nova" se esse `headroom`, já considerando a parcela hipotética do próprio desejo, continuar `>= 0`. Sem `Budget` configurado para a categoria (usuário não passou pelo wizard de Metas, ou a categoria não está nele), a função retorna "indeterminado" — não dá falso positivo nem falso negativo, apenas não há informação suficiente para esse critério, e a UI mostra essa lacuna de forma explícita (ver seção de UI/empty states).

   **Armadilha identificada na validação com o agente backend e corrigida aqui:** `getBudgetProgress` de um mês futuro que ainda não começou sempre traz `spent = 0` (não existem transações lançadas ainda) — usar esse `spent` literal infla artificialmente o `headroom`, ignorando que gastos recorrentes não-parcelados (alimentação, transporte etc.) tendem a se repetir mês a mês. Por isso `spentEstimado` da categoria no mês futuro **não é `0`**: usa a média histórica da categoria via `getCategoryHistoricalAverages(userId)` (`src/lib/budget-data.ts`, já existente) como proxy de gasto recorrente esperado, e só então subtrai do `limitAmount` junto com o `committed`. Isso evita "pode comprar" otimista demais.

Essa função fica isolada em `src/lib/wish-readiness.ts` (lib pura, sem chamada de Prisma própria — recebe os dados já buscados pelo resolver da página, no mesmo espírito de `installment-resolver.ts` ser puro e testável).

## Decisões de produto confirmadas

1. **Categoria e subcategoria são obrigatórias no cadastro** (requisito explícito do usuário) — reaproveita `resolveCategoryAndSubcategory` (`src/lib/category-resolver.ts`), que já valida que o sub-grupo pertence ao grupo informado e ao usuário.
2. **Estratégia de economia é opcional no cadastro, mas incentivada.** Separar "registrar o desejo" de "se comprometer com um plano" reduz fricção inicial — alinhado ao próprio pedido do usuário de "baixa fricção no cadastro, fricção saudável só antes da decisão de compra por impulso".
3. **Cooling-off é automático por faixa de valor, não uma escolha do usuário.** Desejos com `estimatedAmount` acima de um threshold (proposta inicial: **R$ 300**, configurável depois — não é um valor com research específico, é ponto de partida ajustável, mesmo espírito do "50/30/20 é sugestão, não obrigação" já usado no plano de Metas) entram automaticamente em cooling-off de **3 dias corridos** a partir do cadastro. Durante esse período, o card mostra "disponível para comprar em X dias" com um link curto explicando o motivo (psicoeducação, não bloqueio arbitrário) — nunca esconde o botão silenciosamente.
4. **Resultado da jornada tem 3 desfechos, sem estado intermediário ambíguo**: `ACTIVE` (acumulando/aguardando), `PURCHASED` (concluído, idealmente linkado a uma `Transaction` real), `ABANDONED` (desistência sem culpa). Não existe "pausado" na v1 — abandonar e cadastrar de novo depois é aceitável e mais simples que reabrir histórico.
5. **Forma da jornada: modal de cadastro curto (não wizard) + página de detalhe.** Diferente do wizard de Metas (sequência obrigatória de steps que termina num único objetivo), aqui o cadastro é autocontido e o resto da jornada (estratégia, progresso, cooling-off, decisão) acontece em momentos distintos ao longo de semanas — forçar wizard contradiz o próprio requisito de baixa fricção. Cadastro = `Modal` com no máximo 2 telas (dados do desejo → convite opcional de estratégia). Acompanhamento = página `/desejos/[id]`.
6. **Notificação "pode comprar" no MVP é só badge in-app**, sem push/e-mail — o projeto não tem infra de notificação push ou de envio de e-mail transacional hoje (`Notification` existe no schema mas é só uma tabela lida internamente, sem nenhum canal de envio externo implementado). Push/e-mail fica para uma iteração futura, fora de escopo.
7. **Framing de progresso é dinâmico**: gap ("faltam R$ X") em destaque visual até 60% do progresso; a partir disso, o valor acumulado ("você já tem R$ Y") passa a ganhar destaque — não é uma escolha fixa de UI, é condicionada ao `progressPercent` do desejo.

## O que já existe no projeto (reaproveitar)

- **Categoria hierárquica + validação**: `Category` (`prisma/schema.prisma`) e `resolveCategoryAndSubcategory` (`src/lib/category-resolver.ts`) — validam que grupo é raiz do usuário e sub-grupo é filho do grupo informado. É a validação a reaproveitar 1:1 no cadastro do desejo.
- **`Goal`**: já modela meta de economia com `targetAmount`/`currentAmount`/`deadline`/`categoryId?`. Vamos estender (não recriar) para servir de "estratégia de economia" de um desejo.
- **`getInstallmentCommitmentsByCategory(userId, monthKey)`** (`src/lib/budget-data.ts`) — já calcula, por categoria, o valor comprometido em parcelas projetadas para um mês, distinguindo parcela já lançada (não soma duplicado) de parcela futura. É a peça central do critério 2 de "pode comprar" — não precisa recalcular nada do zero, só chamar para dois meses (atual e seguinte) e comparar.
- **`getBudgetProgress(userId, monthKey)`** (`src/lib/budget-data.ts`) — já retorna `limitAmount`, `spent` e `committed` por categoria. É a fonte direta do `headroom` (critério 3 de "pode comprar").
- **Padrão de insight derivado sem tabela de decisão** (`InstallmentForecast` em `src/lib/insights-data.ts`, `fixedExpenseAlert`) — referência para "pode comprar" ser sempre calculado, nunca persistido.
- **Tom gamificado já existente**: `src/components/goals/goals-congrats.tsx` (celebração final, ícone `PartyPopper`, badge `bg-(--color-success)/10`, CTA único) é a referência direta de linguagem visual para a celebração de "desejo comprado".
- **Padrão de Server Actions**: `ActionResult { success, message?, fieldErrors? }`, validação Zod antes de tocar o banco (`src/app/(app)/metas/actions.ts` como referência mais recente e mais próxima em estilo).
- **Padrão de lib pura e testável**: `installment-resolver.ts` (função pura recebendo dados já buscados) — modelo para `wish-readiness.ts`.

## O que falta criar

### 1. Schema (`prisma/schema.prisma` + migration)

```prisma
enum WishStatus {
  ACTIVE
  PURCHASED
  ABANDONED
}

model Wish {
  id              String     @id @default(cuid())
  userId          String
  name            String
  estimatedAmount Float
  categoryId      String              // obrigatório — requisito explícito do usuário
  subcategoryId   String              // obrigatório — requisito explícito do usuário
  status          WishStatus @default(ACTIVE)
  notes           String?
  imageUrl        String?
  coolingOffUntil DateTime?           // null quando o valor está abaixo do threshold de fricção
  purchasedAt     DateTime?
  purchasedTransactionId String? @unique
  abandonedAt     DateTime?
  abandonReason   String?             // texto livre opcional, sem categorização — copy neutra, sem culpa
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    Category     @relation("WishCategory", fields: [categoryId], references: [id], onDelete: Restrict)
  subcategory Category     @relation("WishSubcategory", fields: [subcategoryId], references: [id], onDelete: Restrict)
  purchasedTransaction Transaction? @relation(fields: [purchasedTransactionId], references: [id], onDelete: SetNull)
  goal        Goal?

  @@index([userId, status])
  @@index([categoryId])
  @@index([subcategoryId])
  @@map("wishes")
}
```

Em `Goal`, adicionar vínculo opcional 1:1 com o desejo (aditivo, não quebra nenhum `Goal` existente que hoje não tem desejo nenhum) e o índice de `userId` que falta hoje no model (apontado na validação com o agente backend — `Goal` nunca teve nenhum consumidor de query além do schema, então este módulo será o primeiro a de fato precisar do índice):

```prisma
model Goal {
  // ...campos existentes
  wishId String? @unique

  wish Wish? @relation(fields: [wishId], references: [id], onDelete: SetNull)

  @@index([userId])
}
```

Em `User`, adicionar `wishes Wish[]`, seguindo o padrão de todas as outras entidades.

**Notas de modelagem:**

- `categoryId`/`subcategoryId` usam `onDelete: Restrict` (não `SetNull` como em `Transaction`/`InstallmentPlan`) — proposital: como categoria e subcategoria são **obrigatórias** no desejo (requisito de produto, são a base do cálculo futuro de "pode comprar"), um `Wish` nunca pode ficar sem elas. Se o usuário tentar excluir uma categoria com desejos vinculados, a exclusão deve ser bloqueada e a UI de categorias precisa comunicar isso claramente — ponto de atenção a validar com o agente de frontend/backend ao implementar a tela de categorias (fora do escopo deste módulo, mas é uma consequência direta dele).
- `purchasedTransactionId` único e opcional: quando o desejo é marcado como comprado, opcionalmente linka à `Transaction` real lançada (mesmo padrão do vínculo `FixedExpenseOccurrence.transactionId` no módulo de despesas fixas) — permite ao usuário decidir registrar a compra como lançamento normal ou só marcar como concluído sem lançamento (ex.: já vinha pagando via parcelamento, a "compra" é só o reconhecimento da meta atingida).
- `Goal.wishId` único garante 1:1 (um `Goal` serve a no máximo um desejo) — mas um `Goal` "solto" (sem `wishId`) continua existindo livremente como hoje, sem nenhuma mudança de comportamento para o módulo de Metas de economia.
- Sem coluna "pode comprar" persistida — é sempre derivado (ver seção de arquitetura).

### 2. Lib de domínio (`src/lib/wish-readiness.ts`, novo)

Função pura `evaluateWishReadiness(wish, goal, currentMonthCommitted, nextMonthCommitted, budgetLimit, categoryHistoricalAverage)`:

- Critério 1 — economia suficiente: `goal && goal.currentAmount >= wish.estimatedAmount`.
- Critério 2 — capacidade de parcela liberada: `currentMonthCommitted - nextMonthCommitted > 0` (comprometido cai do mês atual para o mês futuro de referência), retornando o valor liberado.
- Critério 3 — não estoura a meta: se `budgetLimit` para a categoria existir, calcula `headroom = budgetLimit - categoryHistoricalAverage - nextMonthCommitted` (usando a média histórica como proxy de gasto recorrente esperado no mês futuro, nunca `0` — ver nota de armadilha na seção de arquitetura) e só confirma "pode comprar via parcela" se `headroom >= 0` considerando a capacidade liberada do critério 2. Sem `Budget` configurado para a categoria, retorna `indeterminate: true` nesse critério (nunca falso positivo).
- Retorna um objeto tipado `WishReadiness { canAfford: boolean; reason: "savings" | "installment_freed" | "not_yet"; budgetCheck: "ok" | "would_exceed" | "indeterminate" }`.

### 3. Validações (`src/lib/validations/wish.ts`, novo)

- `createWishSchema`: `name` (min 2 chars), `estimatedAmount` (> 0, teto de sanidade), `categoryId`/`subcategoryId` (obrigatórios, `min(1)`), `notes`/`imageUrl` opcionais.
- `linkWishGoalSchema`: `wishId`, e ou `goalId` (vincular existente) ou `targetAmount`/`deadline?` (criar novo `Goal`).
- `markWishPurchasedSchema`: `wishId`, `createTransaction: boolean`, campos de transação opcionais se `createTransaction`.
- `abandonWishSchema`: `wishId`, `reason?` (texto livre, opcional, sem obrigar justificativa).

### 4. Resolver de elegibilidade ao carregar a página (`src/lib/wish-data.ts`, novo)

- `getWishesPageData(userId)`: busca todos os `Wish` do usuário com `category`, `subcategory`, `goal` incluídos; para os `ACTIVE`, busca em paralelo (`Promise.all`) `getInstallmentCommitmentsByCategory` do mês atual e do mês futuro de referência, `getBudgetProgress` (para `limitAmount` por categoria) e `getCategoryHistoricalAverages(userId)` (proxy de gasto recorrente esperado) — cada chamada uma única vez por usuário/mês, reaproveitada entre todos os desejos da mesma categoria (evita N chamadas redundantes). Aplica `evaluateWishReadiness` por desejo.
- `getWishDetail(userId, wishId)`: mesma lógica, escopada a um desejo, para a página de detalhe.
- **Reaproveitamento de cálculo de previsão de término de parcelamento**: o núcleo de cálculo "quando um `InstallmentPlan` termina" já existe duplicável em `installmentForecasts` (`src/lib/insights-data.ts`, ~linhas 336-356), hoje misturado com formatação de label para a tela de Insights. Antes de implementar, extrair o núcleo puro (`remainingInstallments`, `endDate` por plano) para um helper compartilhado (ex.: `getInstallmentForecastsByCategory` em `src/lib/installment-resolver.ts` ou novo arquivo `src/lib/installment-forecast.ts`), consumido tanto por Insights quanto por este módulo — evita duplicar a lógica de projeção em dois lugares.

### 5. Server Actions (`src/app/(app)/desejos/actions.ts`, novo)

Seguindo o padrão `ActionResult` já usado em `metas/actions.ts`:

- `createWishAction(prev, formData)` — valida com Zod, chama `resolveCategoryAndSubcategory`, calcula `coolingOffUntil` (now + 3 dias) se `estimatedAmount >= 300, senão `null`, cria o `Wish`.
- `linkWishGoalAction(prev, formData)` — vincula `Goal` existente (valida que pertence ao usuário e não está vinculada a outro desejo) ou cria um novo `Goal` com `wishId` já setado, dentro de `prisma.$transaction`.
- `addWishContributionAction(prev, formData)` — atalho de "aportar R$ X agora" no `Goal` vinculado (`currentAmount += amount`), reaproveitando a mesma ideia de aporte que o módulo de Metas de economia eventualmente formalizar (se já existir uma action de aporte de `Goal`, reaproveitar; caso não exista ainda, esta action também serve de primeira implementação reaproveitável por Metas).
- `markWishPurchasedAction(prev, formData)` — dentro de `prisma.$transaction`: `findFirst({ where: { id: wishId, userId } })` (nunca `findUnique` puro, ver Segurança), opcionalmente cria `Transaction` real e linka via `purchasedTransactionId`, atualiza `status: PURCHASED`, `purchasedAt`. Invalida caches relevantes (dashboard/comparativo/insights, se a transação foi criada).
- `abandonWishAction(prev, formData)` — `findFirst` com `userId`, atualiza `status: ABANDONED`, `abandonedAt`, `abandonReason?`.
- `reactivateWishAction` (opcional, v1.1) — permite voltar um `ABANDONED` para `ACTIVE` sem recriar do zero.

### 6. Páginas e componentes (`src/app/(app)/desejos/`, `src/components/wishes/`, novos)

- `src/app/(app)/desejos/page.tsx` — lista de desejos ativos em grid de cards + seções colapsáveis para "comprados"/"abandonados" (histórico, não some). Botão "Novo desejo" abre o modal de cadastro.
- `src/components/wishes/wish-card.tsx` — card por desejo: nome, categoria/subcategoria (badge), barra de progresso (framing dinâmico gap/acumulado conforme `progressPercent`), badge de status ("Pode comprar!" em `--color-success`, "Disponível em X dias" durante cooling-off, "Sem plano de economia" com CTA quando `goalId` é null), milestone visual discreto em 25/50/75%.
- `src/components/wishes/wish-form-modal.tsx` — modal de cadastro, 2 telas internas (dados do desejo → convite opcional de estratégia), usando `useActionState` + `ActionResult`, reaproveitando o seletor de categoria/subcategoria já usado em `transaction-form.tsx`.
- `src/components/wishes/wish-strategy-step.tsx` — tela 2 do modal: "Vincular meta existente" / "Criar meta de economia agora" / "Decidir depois", com microcopy de pre-commitment (ex.: framing de benefício de ter um plano, sem dado estatístico inventado).
- `src/app/(app)/desejos/[id]/page.tsx` — página de detalhe: progresso ampliado, histórico de aportes, estado de cooling-off com explicação, badge "pode comprar" com o motivo (`reason`), botões de decisão final (Comprar / Abandonar / Continuar acumulando).
- `src/components/wishes/wish-purchase-modal.tsx` — modal de conclusão: pergunta se quer lançar a compra como `Transaction` real (valor pode divergir do estimado) ou só marcar como concluída.
- `src/components/wishes/wish-abandon-dialog.tsx` — `ConfirmDialog` com copy explicitamente sem culpa (ex.: "Tudo bem mudar de prioridade. Quer registrar o motivo? (opcional)") — não reaproveitar microcopy genérica de exclusão destrutiva usada em outros lugares do app.
- `src/components/wishes/wish-milestone-toast.tsx` — toast leve disparado client-side quando o progresso cruza 25/50/75% (comparação feita no client a partir do progresso recebido do server, sem necessidade de nova tabela de "marcos atingidos").
- `src/components/layout/nav-items.ts` — novo item de navegação (`{ href: "/desejos", label: "Desejos", icon: ... }`, ícone sugerido `Sparkles` ou `Gift` do lucide-react, para reforçar o tom gamificado sem colidir com ícones já usados).

### 7. Integração com Metas/Parcelamentos (consequência direta do cálculo de "pode comprar")

- Nenhuma mudança de schema adicional é necessária em `Budget`/`InstallmentPlan` — a integração é só de leitura (chamadas a `getInstallmentCommitmentsByCategory`/`getBudgetProgress` já existentes).
- Atenção a um efeito colateral: se o usuário concluir um desejo criando uma `Transaction` real numa categoria que já está no limite do `Budget` do mês, isso deve aparecer normalmente como "acima da meta" na tela de Metas (comportamento que já existe hoje para qualquer lançamento) — não há necessidade de tratamento especial, é o comportamento correto por padrão.
- A página de Metas (`src/app/(app)/metas/page.tsx`) não precisa de nenhuma alteração nesta v1 — a Lista de Desejos só consome dados de lá, não escreve.

### 8. Verificação

- `npx tsc --noEmit`, `npx eslint`, `npm run build`.
- Roteiro manual (detalhado na seção de testes do checklist abaixo).

## Decisões abertas — revisar com o usuário antes de implementar

1. **Valor do threshold de cooling-off (R$ 300)**: é um ponto de partida arbitrário, sem pesquisa específica por trás (diferente da regra 50/30/20, que tem referência). Confirmar se esse valor faz sentido para o perfil de usuário do produto, ou se deveria ser proporcional à renda (`BudgetIncome`) em vez de um valor fixo em reais.
2. **Duração do cooling-off (3 dias)**: mesma ressalva — valor de partida ajustável, não uma constante validada.
3. **`onDelete: Restrict` em `categoryId`/`subcategoryId` do `Wish`**: confirmar que bloquear a exclusão de uma categoria com desejos vinculados é aceitável, ou se o produto prefere permitir a exclusão e tratar o desejo órfão de outra forma (ex.: forçar recategorização antes de excluir a categoria).
4. **Aporte manual em `Goal` (`addWishContributionAction`)**: hoje não há nenhuma action de "aportar em uma meta" no módulo de Metas de economia existente — confirmar se este módulo deve ser o primeiro a implementar isso (e o módulo de Metas reaproveita depois) ou se já existe uma decisão de produto separada sobre como o aporte deve funcionar no módulo de Metas que este plano desconhece.

## Lista de tarefas

### Schema / migration
- [ ] Adicionar enum `WishStatus` (`ACTIVE`, `PURCHASED`, `ABANDONED`) em `prisma/schema.prisma`.
- [ ] Adicionar model `Wish` (campos, relações `category`/`subcategory` com `onDelete: Restrict`, `purchasedTransaction`, `goal`) em `prisma/schema.prisma`.
- [ ] Adicionar `wishId String? @unique` e relação `wish` em `Goal`.
- [ ] Adicionar relação `wishes Wish[]` em `User`.
- [ ] Gerar e revisar a migration (`npx prisma migrate dev`), validando que não impacta dados existentes de `Goal`.

### Lib / domínio (backend)
- [ ] Criar `src/lib/validations/wish.ts` com os 4 schemas Zod (`createWishSchema`, `linkWishGoalSchema`, `markWishPurchasedSchema`, `abandonWishSchema`).
- [ ] Criar `src/lib/wish-readiness.ts` com `evaluateWishReadiness` (função pura, testável) implementando os 3 critérios de "pode comprar".
- [ ] Criar `src/lib/wish-data.ts` com `getWishesPageData(userId)` e `getWishDetail(userId, wishId)`, reaproveitando `getInstallmentCommitmentsByCategory`/`getBudgetProgress` sem chamadas redundantes por categoria repetida.
- [ ] Confirmar threshold/duração de cooling-off com o usuário (decisões abertas 1 e 2) antes de fixar as constantes em código.

### Server Actions (backend)
- [ ] Criar `src/app/(app)/desejos/actions.ts` com `createWishAction`.
- [ ] Implementar `linkWishGoalAction` (vincular `Goal` existente ou criar novo, dentro de `prisma.$transaction`).
- [ ] Implementar `addWishContributionAction` (decisão aberta 4 — confirmar antes com o usuário se este é o lugar certo de implementar aporte).
- [ ] Implementar `markWishPurchasedAction` (com `findFirst` escopado por `userId` dentro da transaction, criação opcional de `Transaction`, invalidação de caches).
- [ ] Implementar `abandonWishAction`.
- [ ] Garantir que toda action usa `findFirst({ where: { id, userId } })`, nunca `findUnique` puro nem confia em join implícito sem repetir `userId`.

### Componentes / UI (frontend)
- [ ] Criar `src/components/wishes/wish-card.tsx` (progresso com framing dinâmico, badges de status, milestone visual).
- [ ] Criar `src/components/wishes/wish-form-modal.tsx` (cadastro em até 2 telas, baixa fricção).
- [ ] Criar `src/components/wishes/wish-strategy-step.tsx` (convite opcional de estratégia, copy de pre-commitment).
- [ ] Criar `src/components/wishes/wish-purchase-modal.tsx` (decisão de compra, com ou sem `Transaction`).
- [ ] Criar `src/components/wishes/wish-abandon-dialog.tsx` (copy sem culpa).
- [ ] Criar `src/components/wishes/wish-milestone-toast.tsx` (celebração leve em 25/50/75%).
- [ ] Adicionar item de navegação em `src/components/layout/nav-items.ts`.

### Páginas
- [ ] Criar `src/app/(app)/desejos/page.tsx` (lista + seções de histórico).
- [ ] Criar `src/app/(app)/desejos/[id]/page.tsx` (detalhe, cooling-off, decisão final).
- [ ] Tratar empty states: sem nenhum desejo cadastrado (CTA de boas-vindas), categoria sem `Budget` configurado (critério 3 "indeterminado" explicado na UI, não escondido).

### Integração com Metas / Parcelamentos
- [ ] Validar que `getInstallmentCommitmentsByCategory`/`getBudgetProgress` cobrem os casos de borda do módulo de desejos sem precisar de nenhuma alteração nesses arquivos (leitura pura).
- [ ] Confirmar com o usuário a decisão aberta 3 (`onDelete: Restrict` em categoria) antes de tocar a tela de exclusão de categorias, se existir.

### Testes / verificação
- [ ] Roteiro manual: cadastrar desejo barato (sem cooling-off) → aparece imediatamente disponível para "comprar agora".
- [ ] Roteiro manual: cadastrar desejo caro (>= threshold) → cooling-off ativo, botão de compra mostra contagem, não desaparece silenciosamente.
- [ ] Roteiro manual: vincular `Goal` existente a um desejo → progresso reflete `Goal.currentAmount`/`targetAmount` corretamente.
- [ ] Roteiro manual: criar `Goal` nova a partir do convite de estratégia → `Goal.wishId` setado, aparece também (se for o caso) na tela de Metas de economia sem comportamento estranho.
- [ ] Roteiro manual: parcelamento da mesma categoria do desejo termina entre o mês atual e o seguinte → badge "pode comprar" reflete a capacidade liberada, sem estourar `Budget` da categoria.
- [ ] Roteiro manual: categoria do desejo sem `Budget` configurado → critério de orçamento mostra "indeterminado", nunca falso positivo de "pode comprar".
- [ ] Roteiro manual: marcar como comprado com criação de `Transaction` → transação aparece em Lançamentos normalmente, Dashboard/Comparativo/Insights refletem sem reload forçado.
- [ ] Roteiro manual: marcar como comprado sem criar `Transaction` → desejo sai da lista ativa, vai para o histórico, nenhuma transação nova é criada.
- [ ] Roteiro manual: abandonar desejo → copy sem culpa em todos os pontos de contato (confirmação e estado final), item vai para histórico sem apagar dados.
- [ ] Roteiro manual: tentar concluir/abandonar `wishId` de outro usuário via chamada direta de action → erro genérico, nenhuma mutação ocorre.
- [ ] `npx tsc --noEmit`, `npx eslint`, `npm run build`.

### Revisão de segurança
- [ ] Confirmar que toda Server Action de mutação usa `findFirst` escopado por `userId`, nunca `findUnique` puro.
- [ ] Confirmar que a verificação de propriedade do `Wish`/`Goal` ocorre **dentro** da mesma `prisma.$transaction` que faz a mutação (evitar TOCTOU), seguindo o padrão já validado no módulo de despesas fixas.
- [ ] Confirmar que erros de "não encontrado" e "pertence a outro usuário" retornam a mesma mensagem genérica (sem diferenciação que permita enumeração/IDOR).
- [ ] Validar que `estimatedAmount`/`amount` de transação de compra têm teto de sanidade no Zod, mesmo padrão já usado em despesas fixas.
- [ ] Validar que a criação de `Goal` a partir de um desejo não permite vincular um `Goal` que já pertence a outro `Wish` (constraint `@@unique` no `wishId` cobre no banco, mas a action precisa tratar o erro de constraint de forma amigável, não como erro 500 cru).
