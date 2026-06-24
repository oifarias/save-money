"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { createWishBatchAction } from "@/app/(app)/desejos/actions";
import { PAYMENT_METHOD_LABELS, PURCHASE_TIMING_LABELS, WISH_KIND_LABELS, WISH_KIND_OPTIONS } from "@/lib/wish-labels";
import type { WishKind, WishPaymentMethod, WishPurchaseTiming } from "@/generated/prisma/client";

export type WishFormCategory = { id: string; name: string; children: { id: string; name: string }[] };

const TIMING_OPTIONS: WishPurchaseTiming[] = ["THIS_MONTH", "NEXT_MONTH", "LATER"];

function radioCardClass(active: boolean) {
  return `flex-1 cursor-pointer rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-colors ${
    active
      ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
      : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40"
  }`;
}

function kindButtonClass(active: boolean) {
  return `flex-1 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-colors ${
    active ? "border-transparent text-white" : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40"
  }`;
}

type ItemDraft = {
  key: string;
  name: string;
  amount: string;
  link: string;
  purchaseTiming: WishPurchaseTiming;
  paymentMethod: WishPaymentMethod;
  installmentsCount: string;
  kind: WishKind;
};

type WishBatchModalProps = {
  open: boolean;
  categories: WishFormCategory[];
  onClose: () => void;
  onAdded: () => void;
};

function createItem(): ItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    amount: "",
    link: "",
    purchaseTiming: "THIS_MONTH",
    paymentMethod: "CASH",
    installmentsCount: "1",
    kind: "WANT",
  };
}

export function WishBatchModal({ open, categories, onClose, onAdded }: WishBatchModalProps) {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([createItem()]);
  const [expandedKey, setExpandedKey] = useState<string | null>(items[0]?.key ?? null);
  const [isPending, startTransition] = useTransition();

  const subcategoryOptions = categories.find((category) => category.id === categoryId)?.children ?? [];
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedSubcategory = subcategoryOptions.find((subcategory) => subcategory.id === subcategoryId);

  function reset() {
    setCategoryId("");
    setSubcategoryId("");
    const initial = createItem();
    setItems([initial]);
    setExpandedKey(initial.key);
  }

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    const item = createItem();
    setItems((current) => [...current, item]);
    setExpandedKey(item.key);
  }

  function removeItem(key: string) {
    setItems((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((item) => item.key !== key);
      setExpandedKey((expanded) => (expanded === key ? next[next.length - 1].key : expanded));
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  const validItems = items.filter((item) => item.name.trim() && (Number(item.amount.replace(",", ".")) || 0) > 0);
  const canSubmit = Boolean(categoryId && subcategoryId) && validItems.length > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await createWishBatchAction({
        categoryId,
        subcategoryId,
        items: validItems.map((item) => {
          const amountValue = Number(item.amount.replace(",", ".")) || 0;
          const installments = Math.max(1, Number(item.installmentsCount) || 1);

          return {
            name: item.name.trim(),
            estimatedAmount: amountValue,
            link: item.link.trim() ? item.link.trim() : undefined,
            purchaseTiming: item.purchaseTiming,
            paymentMethod: item.paymentMethod,
            installmentsCount: item.paymentMethod === "INSTALLMENTS" ? installments : undefined,
            kind: item.kind,
          };
        }),
      });

      if (!result.success) {
        toast.error(result.message ?? "Não foi possível cadastrar os itens");
        return;
      }

      toast.success(result.message ?? "Itens cadastrados");
      reset();
      onAdded();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      title="Novo item"
      size="lg"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        {categoryId && subcategoryId && (
          <p className="text-xs text-(--color-text-muted)">
            Todos os itens abaixo serão cadastrados nesse mesmo grupo e sub-grupo.
          </p>
        )}

        <div className="flex flex-col gap-4">
          {items.map((item, index) => {
            const amountValue = Number(item.amount.replace(",", ".")) || 0;
            const installments = Math.max(1, Number(item.installmentsCount) || 1);
            const installmentAmount = item.paymentMethod === "INSTALLMENTS" && amountValue > 0 ? amountValue / installments : null;
            const isExpanded = expandedKey === item.key;

            if (!isExpanded) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleExpanded(item.key)}
                  className="flex flex-col gap-0.5 rounded-xl border border-(--color-border) p-3.5 text-left transition-colors hover:border-(--color-primary)/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-(--color-text)">
                      {item.name || `Item ${index + 1}`}{" "}
                      <span className="font-numeric text-(--color-text-muted)">
                        {amountValue > 0 ? formatCurrency(amountValue) : ""}
                      </span>
                    </p>
                    <ChevronDown className="h-4 w-4 shrink-0 text-(--color-text-muted)" aria-hidden="true" />
                  </div>
                  {selectedCategory && selectedSubcategory && (
                    <p className="text-xs text-(--color-text-muted)">
                      {selectedCategory.name} · {selectedSubcategory.name} · {WISH_KIND_LABELS[item.kind]}
                    </p>
                  )}
                </button>
              );
            }

            return (
              <div key={item.key} className="flex flex-col gap-4 rounded-xl border border-(--color-border) p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-(--color-text)">Item {index + 1}</p>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      title="Remover item"
                      aria-label="Remover item"
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger) cursor-pointer"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <Input
                  label="Nome do item"
                  placeholder="Ex.: Geladeira nova"
                  value={item.name}
                  onChange={(e) => updateItem(item.key, { name: e.target.value })}
                  required
                />
                <Input
                  label="Valor estimado (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={item.amount}
                  onChange={(e) => updateItem(item.key, { amount: e.target.value })}
                  className="font-numeric"
                  required
                />
                <Input
                  label="Link do item (opcional)"
                  type="url"
                  placeholder="https://..."
                  value={item.link}
                  onChange={(e) => updateItem(item.key, { link: e.target.value })}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--color-text)">Tipo</label>
                  <div className="flex gap-2">
                    {WISH_KIND_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isActive = item.kind === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateItem(item.key, { kind: option.value })}
                          className={kindButtonClass(isActive)}
                          style={isActive ? { backgroundColor: option.color } : undefined}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5">
                  <p className="text-sm font-medium text-(--color-text)">Como você planeja comprar?</p>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-(--color-text-muted)">Quando deseja comprar</label>
                    <div className="flex gap-2">
                      {TIMING_OPTIONS.map((timing) => (
                        <button
                          key={timing}
                          type="button"
                          onClick={() => updateItem(item.key, { purchaseTiming: timing })}
                          className={radioCardClass(item.purchaseTiming === timing)}
                        >
                          {PURCHASE_TIMING_LABELS[timing]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-(--color-text-muted)">Forma de pagamento</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateItem(item.key, { paymentMethod: "CASH" })}
                        className={radioCardClass(item.paymentMethod === "CASH")}
                      >
                        {PAYMENT_METHOD_LABELS.CASH}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.key, { paymentMethod: "INSTALLMENTS" })}
                        className={radioCardClass(item.paymentMethod === "INSTALLMENTS")}
                      >
                        {PAYMENT_METHOD_LABELS.INSTALLMENTS}
                      </button>
                    </div>
                  </div>

                  {item.paymentMethod === "INSTALLMENTS" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-(--color-text-muted)">Em quantas parcelas (sem juros)</label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={item.installmentsCount}
                        onChange={(e) => updateItem(item.key, { installmentsCount: e.target.value })}
                        className="font-numeric"
                      />
                      {installmentAmount !== null && installmentAmount > 0 && (
                        <p className="text-xs text-(--color-text-muted)">
                          {installments}x de{" "}
                          <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(installmentAmount)}</span> ·
                          esse valor só passa a comprometer seu orçamento quando você marcar a compra como realizada
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="secondary" onClick={addItem} disabled={!categoryId || !subcategoryId}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar outro item nesse grupo
        </Button>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit} isLoading={isPending}>
            Cadastrar {validItems.length} item{validItems.length === 1 ? "" : "s"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
