/**
 * Avaliação de "quando posso comprar" e "quanto preciso guardar por mês" para um desejo — sempre
 * derivada em tempo de leitura, nunca persistida (mesmo espírito de `InstallmentForecast`/
 * `fixedExpenseAlert`). Função pura: recebe todos os dados já buscados pelo resolver da página
 * (`src/lib/wish-data.ts`), sem chamada de Prisma própria.
 *
 * Substitui a v1 (cooling-off + booleano "pode comprar") por duas respostas explícitas que o
 * usuário de fato precisa:
 *
 * 1. Timeline de compra à vista via orçamento da categoria: projeta os próximos meses olhando o
 *    quanto já está comprometido em parcelas daquela categoria (`committedByMonth`) — quando esse
 *    comprometido cai (parcela antiga terminando), sobra espaço no limite da categoria para uma
 *    "parcela nova" hipotética do tamanho do desejo. Primeiro mês em que isso acontece é a resposta
 *    a "esse mês, mês que vem, ou só depois que a parcela de X acabar?".
 * 2. Calculadora de economia: se o usuário preferir guardar dinheiro em vez de esperar o orçamento
 *    liberar espaço, quanto precisa guardar por mês — usando a capacidade de economia do orçamento
 *    geral (sobra de `income` após os limites de necessidade/desejo) e, se houver prazo definido na
 *    meta vinculada, o valor mensal necessário para chegar lá a tempo.
 */

export type WishReadinessInput = {
  estimatedAmount: number;
  /** `currentAmount`/`targetAmount`/`deadline` da `Goal` vinculada ao desejo, se houver. */
  goal: { currentAmount: number; targetAmount: number; deadline: Date | null } | null;
  /** `Budget.limitAmount` da categoria do desejo no mês atual; `null` se não configurado. */
  budgetLimit: number | null;
  /** Média histórica de gasto da categoria (proxy de gasto recorrente esperado), via `getCategoryHistoricalAverages`. */
  categoryHistoricalAverage: number;
  /** Comprometido em parcelas da categoria do desejo, mês a mês, a partir do mês atual (índice 0). */
  committedByMonth: { monthKey: string; committed: number }[];
  /** Sobra mensal estimada do orçamento geral (income - limites de necessidade/desejo); `null` se orçamento não configurado. */
  monthlySavingsCapacity: number | null;
};

export type CashTimeline = "now" | "future" | "beyond_horizon" | "indeterminate";

export type WishReadiness = {
  cashTimeline: CashTimeline;
  /** Mês em que o orçamento da categoria comporta a compra à vista; `null` se indeterminado/fora do horizonte. */
  cashAvailableMonthKey: string | null;
  /** 0 = este mês; `null` se indeterminado/fora do horizonte. */
  monthsUntilCash: number | null;
  /** `true` quando o espaço só aparece porque uma parcela em andamento termina antes do mês de referência. */
  freedByInstallmentEnding: boolean;
  savings: {
    hasGoal: boolean;
    alreadyEnough: boolean;
    remainingAmount: number;
    /** Valor mensal necessário para chegar ao `deadline` da meta vinculada; `null` sem prazo definido. */
    monthlyNeededForDeadline: number | null;
    /** Sobra mensal estimada do orçamento geral, repetida aqui para a UI não precisar de outra fonte. */
    suggestedMonthly: number | null;
    /** Quantos meses até juntar o restante, no ritmo de `suggestedMonthly`; `null` sem orçamento configurado. */
    monthsAtSuggestedRate: number | null;
  };
};

const HORIZON_MONTHS = 12;

function diffInMonths(deadline: Date, from: Date) {
  return (deadline.getFullYear() - from.getFullYear()) * 12 + (deadline.getMonth() - from.getMonth());
}

export function evaluateWishReadiness(input: WishReadinessInput): WishReadiness {
  const { estimatedAmount, goal, budgetLimit, categoryHistoricalAverage, committedByMonth, monthlySavingsCapacity } = input;

  let cashTimeline: CashTimeline = "indeterminate";
  let cashAvailableMonthKey: string | null = null;
  let monthsUntilCash: number | null = null;
  let freedByInstallmentEnding = false;

  if (budgetLimit !== null) {
    const currentMonthCommitted = committedByMonth[0]?.committed ?? 0;
    const horizon = committedByMonth.slice(0, HORIZON_MONTHS);
    const firstAffordableIndex = horizon.findIndex(
      (month) => budgetLimit - categoryHistoricalAverage - month.committed >= estimatedAmount
    );

    if (firstAffordableIndex === -1) {
      cashTimeline = "beyond_horizon";
    } else {
      cashAvailableMonthKey = horizon[firstAffordableIndex].monthKey;
      monthsUntilCash = firstAffordableIndex;
      cashTimeline = firstAffordableIndex === 0 ? "now" : "future";
      freedByInstallmentEnding = horizon[firstAffordableIndex].committed < currentMonthCommitted;
    }
  }

  const remainingAmount = goal ? Math.max(0, estimatedAmount - goal.currentAmount) : estimatedAmount;
  const alreadyEnough = Boolean(goal) && goal!.currentAmount >= estimatedAmount;

  let monthlyNeededForDeadline: number | null = null;
  if (goal?.deadline && !alreadyEnough) {
    const monthsLeft = Math.max(1, diffInMonths(goal.deadline, new Date()));
    monthlyNeededForDeadline = remainingAmount / monthsLeft;
  }

  const monthsAtSuggestedRate =
    !alreadyEnough && monthlySavingsCapacity !== null && monthlySavingsCapacity > 0
      ? Math.ceil(remainingAmount / monthlySavingsCapacity)
      : null;

  return {
    cashTimeline,
    cashAvailableMonthKey,
    monthsUntilCash,
    freedByInstallmentEnding,
    savings: {
      hasGoal: Boolean(goal),
      alreadyEnough,
      remainingAmount,
      monthlyNeededForDeadline,
      suggestedMonthly: monthlySavingsCapacity,
      monthsAtSuggestedRate,
    },
  };
}
