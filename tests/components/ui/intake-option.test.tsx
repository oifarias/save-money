// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PenLine } from "lucide-react";
import { IntakeOption } from "../../../src/components/ui/intake-option";

describe("IntakeOption — como link", () => {
  it("renderiza um link com href", () => {
    render(<IntakeOption icon={PenLine} title="Manual" description="Descrição" href="/lancamentos/novo" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/lancamentos/novo");
  });

  it("exibe título e descrição", () => {
    render(<IntakeOption icon={PenLine} title="Manual" description="Adicione lançamentos" href="/x" />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Adicione lançamentos")).toBeInTheDocument();
  });
});

describe("IntakeOption — como botão", () => {
  it("renderiza um button quando onClick é fornecido", () => {
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("chama onClick ao clicar", async () => {
    const handler = vi.fn();
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={handler} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("não renderiza link quando onClick é fornecido", () => {
    render(<IntakeOption icon={PenLine} title="Lote" description="Via CSV" onClick={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
