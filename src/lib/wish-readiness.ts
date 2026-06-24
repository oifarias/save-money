/**
 * Avaliação de "pode comprar" para um desejo — sempre derivada em tempo de leitura, nunca
 * persistida (mesmo espírito de `InstallmentForecast`/`fixedExpenseAlert`). Função pura: recebe
 * todos os dados já buscados pelo resolver da página (`src/lib/wish-data.ts`), sem chamada de
 * Prisma própria — facilita testes unitários e evita acoplar a regra de negócio ao banco.
 *
 * Critérios:
 * 1. Economia suficiente: `goal.currentAmount >= wish.estimatedAmount`, quando há `Goal` vinculada.
 * 2. Capacidade de parcela liberada: o comprometido com parcelamentos da mesma categoria cai do
 *    mês atual para o mês futuro de referência (`currentMonthCommitted - nextMonthCommitted > 0`).
 * 3. Headroom de orçamento: usando a média histórica de gasto da categoria como proxy de gasto
 *    recorrente esperado no mês futuro (nunca `spent = 0` literal de um mês que ainda não começou),
 *    `headroom = budgetLimit - categoryHistoricalAverage - nextMonthCommitted`. Sem `Budget`
 *    configurado para a categoria, o critério retorna `indeterminate` — nunca falso positivo.
 */

export type WishReadinessInput = {
  estimatedAmount: number;
  /** `currentAmount`/`targetAmount` da `Goal` vinculada ao desejo, se houver. */
  goal: { currentAmount: number; targetAmount: number } | null;
  /** Valor comprometido com parcelamentos da categoria do desejo no mês atual. */
  currentMonthCommitted: number;
  /** Valor comprometido com parcelamentos da categoria do desejo no mês futuro de referência. */
  nextMonthCommitted: number;
  /** `Budget.limitAmount` da categoria do desejo no mês de referência; `null` se não configurado. */
  budgetLimit: number | null;
  /** Média histórica de gasto da categoria (proxy de gasto recorrente esperado), via `getCategoryHistoricalAverages`. */
  categoryHistoricalAverage: number;
};

export type WishReadiness = {
  canAfford: boolean;
  reason: "savings" | "installment_freed" | "not_yet";
  /** Capacidade de parcela liberada entre o mês atual e o mês futuro de referência (>= 0). */
  installmentCapacityFreed: number;
  budgetCheck: "ok" | "would_exceed" | "indeterminate";
  /** Headroom de orçamento no mês futuro de referência, já considerando a parcela hipotética do desejo; `null` se indeterminado. */
  budgetHeadroom: number | null;
};

export function evaluateWishReadiness(input: WishReadinessInput): WishReadiness {
  const { estimatedAmount, goal, currentMonthCommitted, nextMonthCommitted, budgetLimit, categoryHistoricalAverage } = input;

  // Critério 1 — economia suficiente
  const savingsSufficient = Boolean(goal) && goal!.currentAmount >= estimatedAmount;

  // Critério 2 — capacidade de parcela liberada (nunca negativa)
  const installmentCapacityFreed = Math.max(0, currentMonthCommitted - nextMonthCommitted);
  const installmentFreed = installmentCapacityFreed > 0;

  // Critério 3 — headroom de orçamento, considerando a parcela hipotética do próprio desejo
  let budgetCheck: WishReadiness["budgetCheck"] = "indeterminate";
  let budgetHeadroom: number | null = null;

  if (budgetLimit !== null) {
    const headroomBeforeWish = budgetLimit - categoryHistoricalAverage - nextMonthCommitted;
    budgetHeadroom = headroomBeforeWish - estimatedAmount;
    budgetCheck = budgetHeadroom >= 0 ? "ok" : "would_exceed";
  }

  const canAffordViaInstallment = installmentFreed && budgetCheck !== "would_exceed";

  let reason: WishReadiness["reason"] = "not_yet";
  let canAfford = false;

  if (savingsSufficient) {
    canAfford = true;
    reason = "savings";
  } else if (canAffordViaInstallment) {
    canAfford = true;
    reason = "installment_freed";
  }

  return {
    canAfford,
    reason,
    installmentCapacityFreed,
    budgetCheck,
    budgetHeadroom,
  };
}
