// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Info } from "lucide-react";
import { Alert } from "../../../src/components/ui/alert";

describe("Alert", () => {
  it("renderiza o conteúdo filho", () => {
    render(<Alert>Mensagem de aviso</Alert>);
    expect(screen.getByText("Mensagem de aviso")).toBeInTheDocument();
  });

  it("renderiza o ícone quando fornecido", () => {
    const { container } = render(<Alert icon={Info}>Aviso</Alert>);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("não renderiza ícone quando omitido", () => {
    const { container } = render(<Alert>Aviso</Alert>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it.each(["success", "info", "warning", "neutral", "default"] as const)(
    "renderiza sem crash na variante %s",
    (variant) => {
      const { container } = render(<Alert variant={variant}>Msg</Alert>);
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it("ícone tem aria-hidden pois é decorativo", () => {
    const { container } = render(<Alert icon={Info}>Aviso</Alert>);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
