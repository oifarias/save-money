import { describe, expect, it } from "vitest";
import { addMonths } from "./installment-resolver";

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
