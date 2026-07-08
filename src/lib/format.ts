export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  // As datas são salvas como "meia-noite UTC" (ver `toInputDate`), então precisamos ler os
  // componentes em UTC aqui também — senão o Intl aplica o timezone local do navegador e a
  // data exibida pode ficar um dia atrás da que aparece no modal de edição.
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    value
  );
}

export function toInputDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toISOString().slice(0, 10);
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
}
