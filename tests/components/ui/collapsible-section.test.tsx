// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CollapsibleSection } from "../../../src/components/ui/collapsible-section";

describe("CollapsibleSection", () => {
  it("renderiza o título", () => {
    render(<CollapsibleSection title="Despesas fixas">conteúdo</CollapsibleSection>);
    expect(screen.getByText("Despesas fixas")).toBeInTheDocument();
  });

  it("renderiza a descrição quando fornecida", () => {
    render(<CollapsibleSection title="X" description="Subtítulo">conteúdo</CollapsibleSection>);
    expect(screen.getByText("Subtítulo")).toBeInTheDocument();
  });

  it("começa aberto por padrão (aria-expanded=true)", () => {
    render(<CollapsibleSection title="X">conteúdo</CollapsibleSection>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("começa fechado quando defaultOpen=false", () => {
    render(<CollapsibleSection title="X" defaultOpen={false}>conteúdo</CollapsibleSection>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("alterna aria-expanded ao clicar", async () => {
    render(<CollapsibleSection title="X">conteúdo</CollapsibleSection>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("renderiza os filhos quando aberto", () => {
    render(<CollapsibleSection title="X">conteúdo visível</CollapsibleSection>);
    expect(screen.getByText("conteúdo visível")).toBeInTheDocument();
  });
});
