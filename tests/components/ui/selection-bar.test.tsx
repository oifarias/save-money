// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../src/components/ui/button";
import { SelectionBar } from "../../../src/components/ui/selection-bar";

describe("SelectionBar", () => {
  it("não renderiza nada quando count=0", () => {
    const { container } = render(<SelectionBar count={0}><Button>Ação</Button></SelectionBar>);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza quando count > 0", () => {
    render(<SelectionBar count={3}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/selecionado/)).toBeInTheDocument();
  });

  it("exibe o count na mensagem", () => {
    render(<SelectionBar count={5}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('usa o label padrão "selecionado(s)"', () => {
    render(<SelectionBar count={2}><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/selecionado\(s\)/)).toBeInTheDocument();
  });

  it("usa label customizado quando fornecido", () => {
    render(<SelectionBar count={2} label="item(ns)"><Button>Ação</Button></SelectionBar>);
    expect(screen.getByText(/item\(ns\)/)).toBeInTheDocument();
  });

  it("renderiza os botões filhos", () => {
    render(<SelectionBar count={2}><Button>Editar</Button></SelectionBar>);
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("botões filhos são clicáveis", async () => {
    const handler = vi.fn();
    render(<SelectionBar count={2}><Button onClick={handler}>Editar</Button></SelectionBar>);
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
