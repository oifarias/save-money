// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../../../src/components/ui/button";
import { PageHeader } from "../../../src/components/ui/page-header";

describe("PageHeader", () => {
  it("renderiza o título", () => {
    render(<PageHeader title="Lançamentos" />);
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
  });

  it("usa h1 por padrão", () => {
    render(<PageHeader title="Lançamentos" />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("usa o nível informado via prop level", () => {
    render(<PageHeader title="Seção" level="h2" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<PageHeader title="X" description="Subtítulo da página" />);
    expect(screen.getByText("Subtítulo da página")).toBeInTheDocument();
  });

  it("não renderiza parágrafo de descrição quando omitido", () => {
    const { container } = render(<PageHeader title="X" />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renderiza o slot de action", () => {
    render(<PageHeader title="X" action={<Button>Novo</Button>} />);
    expect(screen.getByRole("button", { name: "Novo" })).toBeInTheDocument();
  });

  it("não renderiza slot de action quando omitido", () => {
    render(<PageHeader title="X" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
