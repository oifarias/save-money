// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pencil } from "lucide-react";
import { IconActionButton } from "../../../src/components/ui/icon-action-button";

describe("IconActionButton", () => {
  it("aplica aria-label", () => {
    render(<IconActionButton icon={Pencil} label="Editar lançamento" />);
    expect(screen.getByRole("button", { name: "Editar lançamento" })).toBeInTheDocument();
  });

  it("é do tipo button por padrão", () => {
    render(<IconActionButton icon={Pencil} label="Editar" />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("chama onClick ao ser clicado", async () => {
    const handler = vi.fn();
    render(<IconActionButton icon={Pencil} label="Editar" onClick={handler} />);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renderiza o ícone", () => {
    const { container } = render(<IconActionButton icon={Pencil} label="Editar" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it.each(["sm", "md"] as const)("renderiza sem crash no tamanho %s", (size) => {
    const { container } = render(<IconActionButton icon={Pencil} label="X" size={size} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
