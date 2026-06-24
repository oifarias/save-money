/**
 * Núcleo puro de cálculo de "quando um InstallmentPlan termina" e quanto ainda falta pagar.
 * Extraído de `src/lib/insights-data.ts` (antigo bloco de `installmentForecasts`) para ser
 * reaproveitado tanto pela tela de Insights quanto pelo módulo de Lista de Desejos — evita
 * duplicar a lógica de projeção em dois lugares.
 */

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

export type InstallmentPlanForForecast = {
  id: string;
  baseDescription: string;
  totalInstallments: number;
  estimatedAmount: number;
  startDate: Date;
  categoryId: string | null;
  transactions: { installmentNumber: number | null }[];
};

export type InstallmentForecastCore = {
  planId: string;
  baseDescription: string;
  categoryId: string | null;
  remainingInstallments: number;
  totalInstallments: number;
  estimatedAmount: number;
  remainingAmount: number;
  endDate: Date;
};

/**
 * Calcula, para um único `InstallmentPlan`, quantas parcelas ainda restam e em que data o plano
 * termina (projeção: `startDate` + `totalInstallments - 1` meses). Retorna `null` quando o plano
 * já foi totalmente lançado (`remainingInstallments <= 0`) — não é mais "previsão", é histórico.
 */
export function computeInstallmentForecast(plan: InstallmentPlanForForecast): InstallmentForecastCore | null {
  const lastLaunchedInstallment =
    plan.transactions.length > 0 ? Math.max(...plan.transactions.map((t) => t.installmentNumber ?? 0)) : 0;
  const remainingInstallments = plan.totalInstallments - lastLaunchedInstallment;
  if (remainingInstallments <= 0) return null;

  const endDate = addMonths(plan.startDate, plan.totalInstallments - 1);

  return {
    planId: plan.id,
    baseDescription: plan.baseDescription,
    categoryId: plan.categoryId,
    remainingInstallments,
    totalInstallments: plan.totalInstallments,
    estimatedAmount: plan.estimatedAmount,
    remainingAmount: remainingInstallments * plan.estimatedAmount,
    endDate,
  };
}

/** Aplica `computeInstallmentForecast` a uma lista de planos, já ordenada por data de término (mais próxima primeiro). */
export function computeInstallmentForecasts(plans: InstallmentPlanForForecast[]): InstallmentForecastCore[] {
  return plans
    .map(computeInstallmentForecast)
    .filter((forecast): forecast is InstallmentForecastCore => forecast !== null)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
}
