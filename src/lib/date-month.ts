/**
 * Utilidades de "chave de mês" (formato "YYYY-MM") reutilizadas por análise/previsão.
 * Extraídas de src/lib/analise-data.ts para reuso em src/lib/analise-forecast.ts.
 */

export function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function toMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${months[Number(m) - 1]}/${String(y).slice(2)}`;
}

export function addMonthsToKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}
