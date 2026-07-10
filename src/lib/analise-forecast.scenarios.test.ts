import { describe, expect, it } from "vitest";
import { diffInMonths } from "./analise-forecast";

describe("diffInMonths — núcleo do tapering de parcelas na previsão", () => {
  it("cliente compra uma geladeira em 12x começando em março/2026: no mês da compra é a parcela 1", () => {
    console.log("[cenário] geladeira parcelada, 1ª parcela em março/2026 — mês de previsão = março/2026");
    const startDate = new Date(2026, 2, 1); // março/2026
    const projectedInstallmentNumber = diffInMonths(2026, 3, startDate) + 1;
    expect(projectedInstallmentNumber).toBe(1);
  });

  it("3 meses depois da compra, é a 4ª parcela de 12", () => {
    console.log("[cenário] mesma geladeira, mês de previsão = junho/2026 (3 meses depois da compra)");
    const startDate = new Date(2026, 2, 1); // março/2026
    const projectedInstallmentNumber = diffInMonths(2026, 6, startDate) + 1;
    expect(projectedInstallmentNumber).toBe(4);
  });

  it("12ª parcela cai em fevereiro/2027 (11 meses após março/2026) — no mês seguinte já está quitado", () => {
    console.log("[cenário] mês de previsão = fevereiro/2027, a última parcela do parcelamento de 12x");
    const startDate = new Date(2026, 2, 1); // março/2026 = parcela 1
    const totalInstallments = 12;

    const lastInstallment = diffInMonths(2027, 2, startDate) + 1; // fevereiro/2027 = parcela 12
    expect(lastInstallment).toBe(totalInstallments);

    const afterLast = diffInMonths(2027, 3, startDate) + 1; // março/2027, já quitado
    expect(afterLast).toBeGreaterThan(totalInstallments);
  });

  it("mês de previsão anterior à data da primeira parcela: número de parcela é inválido (<1), chamador descarta", () => {
    console.log("[cenário] previsão calculada num mês anterior à compra (não deveria acontecer, mas não pode contar parcela)");
    const startDate = new Date(2026, 2, 1); // março/2026
    const projectedInstallmentNumber = diffInMonths(2026, 1, startDate) + 1; // janeiro/2026
    expect(projectedInstallmentNumber).toBeLessThan(1);
  });

  it("parcelamento iniciado antes da virada do ano: diffInMonths atravessa dezembro→janeiro corretamente", () => {
    console.log("[cenário] compra parcelada em novembro/2025, previsão calculada pra janeiro/2026");
    const startDate = new Date(2025, 10, 1); // novembro/2025
    const projectedInstallmentNumber = diffInMonths(2026, 1, startDate) + 1;
    expect(projectedInstallmentNumber).toBe(3); // nov(1), dez(2), jan(3)
  });
});
