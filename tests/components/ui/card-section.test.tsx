// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendingUp } from "lucide-react";
import { CardSection } from "../../../src/components/ui/card-section";

describe("CardSection", () => {
  it("renderiza o título", () => {
    render(<CardSection icon={TrendingUp} title="Maior crescimento">conteúdo</CardSection>);
    expect(screen.getByText("Maior crescimento")).toBeInTheDocument();
  });

  it("renderiza o subtítulo quando fornecido", () => {
    render(<CardSection icon={TrendingUp} title="X" subtitle="Comparação mensal">conteúdo</CardSection>);
    expect(screen.getByText("Comparação mensal")).toBeInTheDocument();
  });

  it("não renderiza subtítulo quando omitido", () => {
    const { container } = render(<CardSection icon={TrendingUp} title="X">conteúdo</CardSection>);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renderiza os filhos quando empty=false", () => {
    render(<CardSection icon={TrendingUp} title="X"><p>Lista de dados</p></CardSection>);
    expect(screen.getByText("Lista de dados")).toBeInTheDocument();
  });

  it("renderiza emptyMessage e oculta filhos quando empty=true", () => {
    render(
      <CardSection icon={TrendingUp} title="X" empty emptyMessage="Sem dados ainda.">
        <p>Lista de dados</p>
      </CardSection>
    );
    expect(screen.getByText("Sem dados ainda.")).toBeInTheDocument();
    expect(screen.queryByText("Lista de dados")).not.toBeInTheDocument();
  });

  it("usa emptyMessage padrão quando empty=true sem mensagem customizada", () => {
    render(<CardSection icon={TrendingUp} title="X" empty>conteúdo</CardSection>);
    expect(screen.getByText("Ainda não há dados suficientes.")).toBeInTheDocument();
  });
});
