import { describe, expect, it } from "vitest";
import { clampDueDateToMonth } from "./fixed-expense-resolver";

describe("clampDueDateToMonth", () => {
  it("mantém o dia quando ele existe no mês (caso comum)", () => {
    const date = clampDueDateToMonth(2026, 5, 15); // junho/2026, dia 15
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
  });

  it("ajusta dueDay 31 para 30 em meses com 30 dias (abril)", () => {
    const date = clampDueDateToMonth(2026, 3, 31); // abril/2026 (índice 3) tem 30 dias
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(30);
  });

  it("ajusta dueDay 31 para 28 em fevereiro de ano não bissexto", () => {
    const date = clampDueDateToMonth(2026, 1, 31); // fevereiro/2026 não é bissexto
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
  });

  it("ajusta dueDay 31 para 29 em fevereiro de ano bissexto", () => {
    const date = clampDueDateToMonth(2028, 1, 31); // fevereiro/2028 é bissexto
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
  });

  it("ajusta dueDay 30 para 28 em fevereiro de ano não bissexto", () => {
    const date = clampDueDateToMonth(2026, 1, 30);
    expect(date.getDate()).toBe(28);
  });

  it("dueDay 1 sempre é válido, em qualquer mês", () => {
    const date = clampDueDateToMonth(2026, 1, 1);
    expect(date.getDate()).toBe(1);
  });
});
