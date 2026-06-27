// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckCircle2 } from "lucide-react";
import { StatusBadge } from "../../../src/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renderiza o label", () => {
    render(<StatusBadge label="Fixa" />);
    expect(screen.getByText("Fixa")).toBeInTheDocument();
  });

  it("renderiza o ícone quando fornecido", () => {
    const { container } = render(<StatusBadge label="Comprado" icon={CheckCircle2} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("não renderiza ícone quando omitido", () => {
    const { container } = render(<StatusBadge label="Fixa" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it.each(["accent", "primary", "success", "danger", "muted"] as const)(
    "renderiza sem crash na variante %s",
    (variant) => {
      const { container } = render(<StatusBadge label="X" variant={variant} />);
      expect(container.firstChild).toBeInTheDocument();
    }
  );

  it("tamanho xs usa uppercase e tracking-wide", () => {
    const { container } = render(<StatusBadge label="Fixa" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("uppercase");
    expect(span.className).toContain("tracking-wide");
  });

  it("tamanho sm não aplica uppercase", () => {
    const { container } = render(<StatusBadge label="Comprado em jan" size="sm" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).not.toContain("uppercase");
  });
});
