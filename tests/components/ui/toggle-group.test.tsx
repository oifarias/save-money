// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleGroup } from "./toggle-group";

const OPTIONS = [
  { value: "EXPENSE" as const, label: "Despesa", activeColor: "--color-danger" },
  { value: "INCOME"  as const, label: "Entrada", activeColor: "--color-success" },
];

describe("ToggleGroup", () => {
  it("renderiza todas as opções", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Despesa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrada" })).toBeInTheDocument();
  });

  it("a opção ativa tem aria-pressed=true", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Despesa" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opções inativas têm aria-pressed=false", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Entrada" })).toHaveAttribute("aria-pressed", "false");
  });

  it("chama onChange com o valor correto ao clicar", async () => {
    const onChange = vi.fn();
    render(<ToggleGroup value="EXPENSE" onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: "Entrada" }));
    expect(onChange).toHaveBeenCalledWith("INCOME");
  });

  it("renderiza a legend quando fornecida", () => {
    render(<ToggleGroup value="EXPENSE" onChange={vi.fn()} options={OPTIONS} legend="Tipo" />);
    expect(screen.getByText("Tipo")).toBeInTheDocument();
  });
});
