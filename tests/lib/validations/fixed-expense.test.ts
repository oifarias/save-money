import { describe, expect, it } from "vitest";
import { payFixedExpensesSchema } from "@/lib/validations/fixed-expense";

describe("payFixedExpensesSchema", () => {
  it("aceita um lote válido com um ou mais itens", () => {
    const result = payFixedExpensesSchema.safeParse([
      { templateId: "tpl-1", paidAmount: 150.5, paidDate: "2026-06-10" },
      { templateId: "tpl-2", paidAmount: 80, paidDate: "2026-06-23" },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejeita lote vazio", () => {
    const result = payFixedExpensesSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it("rejeita templateId vazio", () => {
    const result = payFixedExpensesSchema.safeParse([{ templateId: "", paidAmount: 10, paidDate: "2026-06-10" }]);
    expect(result.success).toBe(false);
  });

  it("rejeita paidAmount zero ou negativo", () => {
    expect(payFixedExpensesSchema.safeParse([{ templateId: "tpl-1", paidAmount: 0, paidDate: "2026-06-10" }]).success).toBe(false);
    expect(payFixedExpensesSchema.safeParse([{ templateId: "tpl-1", paidAmount: -5, paidDate: "2026-06-10" }]).success).toBe(false);
  });

  it("rejeita paidAmount acima do limite sanidade (10 milhões)", () => {
    const result = payFixedExpensesSchema.safeParse([{ templateId: "tpl-1", paidAmount: 10_000_001, paidDate: "2026-06-10" }]);
    expect(result.success).toBe(false);
  });

  it("rejeita paidDate vazia ou inválida", () => {
    expect(payFixedExpensesSchema.safeParse([{ templateId: "tpl-1", paidAmount: 10, paidDate: "" }]).success).toBe(false);
    expect(payFixedExpensesSchema.safeParse([{ templateId: "tpl-1", paidAmount: 10, paidDate: "não-é-uma-data" }]).success).toBe(false);
  });
});
