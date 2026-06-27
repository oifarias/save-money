// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField } from "../../../src/components/ui/select-field";

describe("SelectField", () => {
  it("renderiza o label vinculado ao select", () => {
    render(
      <SelectField label="Categoria">
        <option value="1">Alimentação</option>
      </SelectField>
    );
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
  });

  it("renderiza os filhos como opções", () => {
    render(
      <SelectField label="Categoria">
        <option value="1">Alimentação</option>
        <option value="2">Transporte</option>
      </SelectField>
    );
    expect(screen.getByRole("option", { name: "Alimentação" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Transporte" })).toBeInTheDocument();
  });

  it("renderiza mensagem de erro quando fornecida", () => {
    render(<SelectField label="Categoria" error="Campo obrigatório" />);
    expect(screen.getByText("Campo obrigatório")).toBeInTheDocument();
  });

  it("não renderiza mensagem de erro quando omitida", () => {
    render(<SelectField label="Categoria" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renderiza o hint quando fornecido", () => {
    render(<SelectField label="Categoria" hint={<button type="button">+ Novo grupo</button>} />);
    expect(screen.getByRole("button", { name: "+ Novo grupo" })).toBeInTheDocument();
  });

  it("repassa props HTML ao select", () => {
    render(<SelectField label="Categoria" name="categoryId" disabled />);
    const select = screen.getByLabelText("Categoria");
    expect(select).toHaveAttribute("name", "categoryId");
    expect(select).toBeDisabled();
  });
});
