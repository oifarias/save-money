import { describe, expect, it } from "vitest";
import { countLabel } from "./forecast-rationale-card";
import type { ForecastRationaleLine } from "@/lib/analise-forecast";

function line(overrides: Partial<ForecastRationaleLine>): ForecastRationaleLine {
  return { key: "fixed", label: "", amount: 0, count: 0, ...overrides };
}

describe("countLabel — texto do card 'Como calculamos essa previsão'", () => {
  it("cliente com 1 despesa fixa ativa (aluguel): singular", () => {
    console.log("[cenário] cliente cadastrou só o aluguel como despesa fixa");
    expect(countLabel(line({ key: "fixed", count: 1 }))).toBe("1 despesa fixa");
  });

  it("cliente com 3 despesas fixas ativas: plural", () => {
    console.log("[cenário] cliente com aluguel, internet e streaming cadastrados como fixos");
    expect(countLabel(line({ key: "fixed", count: 3 }))).toBe("3 despesas fixas");
  });

  it("cliente sem nenhum parcelamento ativo no próximo mês: plural com zero", () => {
    console.log("[cenário] cliente quitou todos os parcelamentos");
    expect(countLabel(line({ key: "installments", count: 0 }))).toBe("0 parcelamentos ativos");
  });

  it("cliente com 1 parcelamento ativo (notebook em 10x): singular", () => {
    console.log("[cenário] cliente ainda pagando o notebook parcelado");
    expect(countLabel(line({ key: "installments", count: 1 }))).toBe("1 parcelamento ativo");
  });

  it("cliente com histórico de exatamente 1 mês fechado pra média de gastos variáveis: singular", () => {
    console.log("[cenário] cliente novo no app, só 1 mês fechado de histórico");
    expect(countLabel(line({ key: "variable", count: 1 }))).toBe("1 mês considerado");
  });

  it("cliente com 3 meses fechados considerados na média de entradas: plural", () => {
    console.log("[cenário] cliente com histórico completo de 3 meses de entradas");
    expect(countLabel(line({ key: "income_avg", count: 3 }))).toBe("3 meses considerados");
  });
});
