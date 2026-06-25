import { describe, expect, it } from "vitest";
import { addMonths, parseInstallmentDescription } from "./installment-resolver";

describe("parseInstallmentDescription", () => {
  it("extrai descrição base, parcela atual e total de um padrão válido", () => {
    const parsed = parseInstallmentDescription("Notebook (3/4)");
    expect(parsed).toEqual({ baseDescription: "Notebook", installmentNumber: 3, totalInstallments: 4 });
  });

  it("ignora espaços extras antes do padrão", () => {
    const parsed = parseInstallmentDescription("Geladeira   (1/6)");
    expect(parsed?.baseDescription).toBe("Geladeira");
  });

  it("rejeita parênteses que não são parcelamento, ex.: '(compartilhada)'", () => {
    expect(parseInstallmentDescription("Conta (compartilhada)")).toBeNull();
  });

  it("rejeita parênteses com sigla, ex.: '(CLT)'", () => {
    expect(parseInstallmentDescription("Salário (CLT)")).toBeNull();
  });

  it("rejeita quando o total de parcelas é 1 (não é parcelamento)", () => {
    expect(parseInstallmentDescription("Compra (1/1)")).toBeNull();
  });

  it("rejeita quando a parcela atual é maior que o total", () => {
    expect(parseInstallmentDescription("Compra (5/4)")).toBeNull();
  });

  it("rejeita quando a parcela atual é zero", () => {
    expect(parseInstallmentDescription("Compra (0/4)")).toBeNull();
  });

  it("rejeita quando não sobra descrição base", () => {
    expect(parseInstallmentDescription("(2/4)")).toBeNull();
  });

  it("retorna null quando a descrição não tem o padrão x/y", () => {
    expect(parseInstallmentDescription("Almoço no shopping")).toBeNull();
  });
});

describe("addMonths", () => {
  it("soma meses dentro do mesmo ano", () => {
    const result = addMonths(new Date(2026, 0, 15), 2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
  });

  it("avança o ano ao cruzar dezembro", () => {
    const result = addMonths(new Date(2026, 10, 10), 3);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(10);
  });

  it("aceita valores negativos para voltar meses", () => {
    const result = addMonths(new Date(2026, 2, 5), -2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(5);
  });
});
