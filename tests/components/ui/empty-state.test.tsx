// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../../src/components/ui/button";
import { EmptyState } from "../../../src/components/ui/empty-state";

describe("EmptyState", () => {
  it("renderiza o título", () => {
    render(<EmptyState title="Nenhum item ainda" />);
    expect(screen.getByText("Nenhum item ainda")).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<EmptyState title="X" description="Crie seu primeiro item." />);
    expect(screen.getByText("Crie seu primeiro item.")).toBeInTheDocument();
  });

  it("não renderiza descrição quando omitida", () => {
    const { container } = render(<EmptyState title="X" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renderiza o action slot quando fornecido", () => {
    render(<EmptyState title="X" action={<Button>Criar</Button>} />);
    expect(screen.getByRole("button", { name: "Criar" })).toBeInTheDocument();
  });

  it("action slot é clicável", async () => {
    const handler = vi.fn();
    render(<EmptyState title="X" action={<Button onClick={handler}>Criar</Button>} />);
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
