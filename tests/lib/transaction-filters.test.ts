import { describe, expect, it } from "vitest";
import { buildTransactionWhere, getEffectivePeriod } from "@/lib/transaction-filters";

/**
 * Mesma fórmula usada em `dashboard-data.ts` (`startOfMonth`/`addMonths`, fuso local) — o card do
 * Dashboard e o filtro de mês de /lancamentos precisam concordar nesses limites, senão os totais
 * exibidos para "o mesmo mês" divergem (bug original que este arquivo cobre).
 */
function localMonthBounds(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 1);
  return { start, end };
}

describe("buildTransactionWhere — filtro de mês", () => {
  it("usa limites de mês em fuso local, iguais aos do dashboard-data.ts", async () => {
    const where = await buildTransactionWhere("user-1", { month: "2026-06" });
    const { start, end } = localMonthBounds(2026, 6);

    expect(where.date).toEqual({ gte: start, lt: end });
  });

  it("calcula corretamente a virada de ano (dezembro -> janeiro)", async () => {
    const where = await buildTransactionWhere("user-1", { month: "2026-12" });
    const { start, end } = localMonthBounds(2026, 12);

    expect(where.date).toEqual({ gte: start, lt: end });
    expect((where.date as { lt: Date }).lt.getFullYear()).toBe(2027);
    expect((where.date as { lt: Date }).lt.getMonth()).toBe(0);
  });

  it("com 'day' informado, restringe a janela a um único dia em fuso local", async () => {
    const where = await buildTransactionWhere("user-1", { month: "2026-06", day: 15 });

    expect(where.date).toEqual({
      gte: new Date(2026, 5, 15),
      lt: new Date(2026, 5, 16),
    });
  });

  it("sem 'month', cai no período rolante padrão (30 dias) em UTC", async () => {
    const where = await buildTransactionWhere("user-1", {});
    const dateFilter = where.date as { gte: Date; lt: Date };

    const spanDays = (dateFilter.lt.getTime() - dateFilter.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(30);
  });

  it("sem 'month', respeita o período explícito informado (ex.: 60 dias)", async () => {
    const where = await buildTransactionWhere("user-1", { period: "60" });
    const dateFilter = where.date as { gte: Date; lt: Date };

    const spanDays = (dateFilter.lt.getTime() - dateFilter.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(60);
  });

  it("período 'all' não aplica filtro de data", async () => {
    const where = await buildTransactionWhere("user-1", { period: "all" });
    expect(where.date).toBeUndefined();
  });
});

describe("getEffectivePeriod", () => {
  it("retorna null quando há um mês explícito selecionado", () => {
    expect(getEffectivePeriod({ month: "2026-06", period: "60" })).toBeNull();
  });

  it("retorna o período informado quando não há mês selecionado", () => {
    expect(getEffectivePeriod({ period: "45" })).toBe("45");
  });

  it("cai no padrão quando nem mês nem período foram informados", () => {
    expect(getEffectivePeriod({}, "60")).toBe("60");
  });
});
