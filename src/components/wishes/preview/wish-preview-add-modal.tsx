"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MockCategory } from "@/lib/wish-mock-data";

type WishPreviewAddModalProps = {
  open: boolean;
  categories: MockCategory[];
  onClose: () => void;
  onAdd: (input: { name: string; estimatedAmount: number; categoryId: string; subcategoryId: string }) => void;
};

export function WishPreviewAddModal({ open, categories, onClose, onAdd }: WishPreviewAddModalProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const subcategoryOptions = categories.find((category) => category.id === categoryId)?.children ?? [];

  function reset() {
    setName("");
    setAmount("");
    setCategoryId("");
    setSubcategoryId("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name || !amount || !categoryId || !subcategoryId) return;
    onAdd({ name, estimatedAmount: Number(amount.replace(",", ".")) || 0, categoryId, subcategoryId });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Novo desejo"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Nome do desejo" placeholder="Ex.: Geladeira nova" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Valor estimado (R$)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-numeric"
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-(--color-text)">Grupo</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
              required
            >
              <option value="">Selecione um grupo</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-(--color-text)">Sub-grupo</label>
            <select
              key={categoryId}
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={subcategoryOptions.length === 0}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Selecione um sub-grupo</option>
              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Cadastrar desejo</Button>
        </div>
      </form>
    </Modal>
  );
}
