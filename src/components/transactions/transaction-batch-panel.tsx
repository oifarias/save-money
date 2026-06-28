"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/transactions/tag-input";
import { CategoryForm } from "@/components/groups/category-form";
import { formatCurrency } from "@/lib/format";
import { createTransactionBatchAction } from "@/app/(app)/lancamentos/actions";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form";

type ItemDraft = {
  key: string;
  type: "EXPENSE" | "INCOME";
  date: string;
  description: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  isFixed: boolean;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  tags: string[];
  isInstallment: boolean;
  totalInstallments: string;
  currentInstallment: string;
  createPastInstallments: boolean;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function createItem(): ItemDraft {
  return {
    key: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "EXPENSE",
    date: todayISODate(),
    description: "",
    amount: "",
    categoryId: "",
    subcategoryId: "",
    isFixed: false,
    recurrence: "NONE",
    tags: [],
    isInstallment: false,
    totalInstallments: "",
    currentInstallment: "1",
    createPastInstallments: false,
  };
}

type TransactionBatchPanelProps = {
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
};

export function TransactionBatchPanel({ categories, tagSuggestions }: TransactionBatchPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemDraft[]>([createItem()]);
  const [expandedKey, setExpandedKey] = useState<string | null>(items[0]?.key ?? null);
  const [isPending, startTransition] = useTransition();
  const [itemErrors, setItemErrors] = useState<Record<string, Record<string, string>>>({});
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  function reset() {
    const initial = createItem();
    setItems([initial]);
    setExpandedKey(initial.key);
    setItemErrors({});
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
      setExpandedKey((expanded) => (expanded === key ? (next[next.length - 1]?.key ?? null) : expanded));
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  function handleCategoryCreated() {
    setCategoryModalOpen(false);
    router.refresh();
    toast("Selecione o novo grupo na lista após a atualização", { icon: "💡" });
  }

  function handleCancel() {
    reset();
    router.push("/lancamentos");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = items.map((item) => ({
      type: item.type,
      date: item.date,
      description: item.description,
      amount: item.amount,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      isFixed: item.isFixed,
      recurrence: item.recurrence,
      tags: item.tags,
      isInstallment: item.isInstallment,
      totalInstallments: item.totalInstallments,
      currentInstallment: item.createPastInstallments && parseInt(item.currentInstallment, 10) > 1 ? "1" : item.currentInstallment,
    }));

    startTransition(async () => {
      const result = await createTransactionBatchAction(payload);
      if (!result.success) {
        toast.error(result.message ?? "Erro ao salvar lançamentos");
        return;
      }
      toast.success(result.message ?? "Lançamentos salvos");
      reset();
      router.push("/lancamentos");
    });
  }

  const totalItems = items.length;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isExpanded = expandedKey === item.key;
            const amountNum = Number(item.amount) || 0;

            if (!isExpanded) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleExpanded(item.key)}
                  className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3.5 text-left transition-colors hover:border-(--color-primary)/40"
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      item.type === "EXPENSE"
                        ? "bg-(--color-danger)/10 text-(--color-danger)"
                        : "bg-(--color-success)/10 text-(--color-success)"
                    )}
                  >
                    {item.type === "EXPENSE" ? (
                      <TrendingDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--color-text)">
                      {item.description || `Item ${index + 1}`}
                    </p>
                    <p className="text-xs text-(--color-text-muted)">
                      {amountNum > 0 ? formatCurrency(amountNum) : "Sem valor"}
                      {item.isFixed && " · Fixa"}
                      {item.isInstallment && item.totalInstallments && (
                        <> · {item.currentInstallment || "1"}/{item.totalInstallments}x</>
                      )}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-(--color-text-muted)" aria-hidden="true" />
                </button>
              );
            }

            const selectedCategory = categories.find((c) => c.id === item.categoryId);
            const subcategoryOptions = selectedCategory?.children ?? [];
            const errors = itemErrors[item.key] ?? {};

            const itemAmountNum = Number(item.amount) || 0;
            const totalNum = parseInt(item.totalInstallments, 10);
            const startNum = parseInt(item.currentInstallment, 10) || 1;
            const pastCount = startNum > 1 ? startNum - 1 : 0;
            const perInstallment = itemAmountNum > 0 && !isNaN(itemAmountNum) && totalNum >= 2 ? itemAmountNum / totalNum : null;
            const creatingCount = totalNum >= 2 && startNum >= 1 && startNum <= totalNum ? totalNum - startNum + 1 : null;

            return (
              <div
                key={item.key}
                className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-(--color-text)">Item {index + 1}</p>
                  <div className="flex items-center gap-1">
                    {totalItems > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label="Remover item"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger)"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.key)}
                      aria-label="Colapsar item"
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-bg)"
                    >
                      <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium text-(--color-text)">Tipo</legend>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1">
                    {(
                      [
                        { value: "EXPENSE", label: "Despesa" },
                        { value: "INCOME", label: "Entrada" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateItem(item.key, {
                            type: option.value,
                            isFixed: false,
                            isInstallment: false,
                            totalInstallments: "",
                            currentInstallment: "1",
                          })
                        }
                        aria-pressed={item.type === option.value}
                        className={clsx(
                          "rounded-lg py-2 text-sm font-medium transition-all duration-200",
                          item.type === option.value
                            ? option.value === "EXPENSE"
                              ? "bg-(--color-danger) text-white shadow-sm"
                              : "bg-(--color-success) text-white shadow-sm"
                            : "text-(--color-text-muted) hover:text-(--color-text)"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Data"
                    type="date"
                    value={item.date}
                    onChange={(e) => updateItem(item.key, { date: e.target.value })}
                    error={errors.date}
                    required
                  />
                  <Input
                    label="Valor (R$)"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={item.amount}
                    onChange={(e) => updateItem(item.key, { amount: e.target.value })}
                    error={errors.amount}
                    className="font-numeric"
                    required
                  />
                </div>

                <Input
                  label="Descrição"
                  type="text"
                  placeholder="Ex.: Almoço no shopping"
                  value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  error={errors.description}
                  required
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-(--color-text)">Grupo</label>
                      <button
                        type="button"
                        onClick={() => setCategoryModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-medium text-(--color-primary) hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Novo grupo
                      </button>
                    </div>
                    <select
                      value={item.categoryId}
                      onChange={(e) => updateItem(item.key, { categoryId: e.target.value, subcategoryId: "" })}
                      className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                    >
                      <option value="">Sem grupo</option>
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
                      key={item.categoryId}
                      value={item.subcategoryId}
                      onChange={(e) => updateItem(item.key, { subcategoryId: e.target.value })}
                      disabled={subcategoryOptions.length === 0}
                      className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Sem sub-grupo</option>
                      {subcategoryOptions.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {item.type === "EXPENSE" && (
                  <>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5 transition-colors has-[:checked]:border-(--color-primary) has-[:checked]:ring-1 has-[:checked]:ring-(--color-primary)">
                      <input
                        type="checkbox"
                        checked={item.isFixed}
                        onChange={(e) => updateItem(item.key, { isFixed: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-(--color-text)">Despesa fixa</span>
                        <span className="text-xs text-(--color-text-muted)">
                          Marque essa opção para que ela apareça todo mês na checklist de despesas fixas leve em consideração despesas que se repetem todo mês.
                      </span>
                      </div>
                    </label>

                    <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5">
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.isInstallment}
                          onChange={(e) =>
                            updateItem(item.key, {
                              isInstallment: e.target.checked,
                              totalInstallments: e.target.checked ? item.totalInstallments : "",
                              currentInstallment: "1",
                            })
                          }
                          className="h-4 w-4 rounded accent-(--color-primary)"
                        />
                        <span className="text-sm font-medium text-(--color-text)">Esta despesa é parcelada?</span>
                      </label>

                      {!item.isInstallment && (
                        <p className="text-xs text-(--color-text-muted)">
                          Marque se esta despesa será paga em mais de uma parcela
                        </p>
                      )}

                      {item.isInstallment && (
                        <>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                            <Input
                              label="Parcela nº"
                              type="number"
                              min="1"
                              max={item.totalInstallments || "360"}
                              placeholder="1"
                              value={item.currentInstallment}
                              onChange={(e) => updateItem(item.key, { currentInstallment: e.target.value, createPastInstallments: false })}
                              error={errors.currentInstallment}
                            />
                            <span className="pb-2.5 text-sm text-(--color-text-muted)">de</span>
                            <Input
                              label="Total"
                              type="number"
                              min="2"
                              max="360"
                              step="1"
                              placeholder="Ex.: 5"
                              value={item.totalInstallments}
                              onChange={(e) => updateItem(item.key, { totalInstallments: e.target.value })}
                              error={errors.totalInstallments}
                              required
                            />
                          </div>

                          {totalNum >= 2 && (
                            <div className="flex flex-col gap-2 rounded-lg border border-(--color-border) px-3.5 py-3">
                              <p className="text-sm text-(--color-text)">
                                {item.createPastInstallments && pastCount > 0 ? (
                                  <>Vamos criar <strong>{totalNum} parcelas</strong> — <strong>{pastCount}</strong> no passado e <strong>{creatingCount}</strong> nos próximos meses</>
                                ) : creatingCount !== null && creatingCount < totalNum ? (
                                  <>Vamos criar <strong>{creatingCount} parcela{creatingCount !== 1 ? "s" : ""}</strong> ({startNum}/{totalNum} até {totalNum}/{totalNum}) nos próximos meses</>
                                ) : (
                                  <>Vamos criar <strong>{totalNum} parcelas</strong> nos próximos meses</>
                                )}
                                {itemAmountNum > 0 ? <>, de <strong>{formatCurrency(itemAmountNum)}</strong> cada</> : null}.
                              </p>

                              {pastCount > 0 && (
                                <label className="flex cursor-pointer items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={item.createPastInstallments}
                                    onChange={(e) => updateItem(item.key, { createPastInstallments: e.target.checked })}
                                    className="h-4 w-4 rounded accent-(--color-primary)"
                                  />
                                  <span className="text-xs text-(--color-text)">
                                    Criar também as {pastCount} parcela{pastCount !== 1 ? "s" : ""} anteriores (passado)
                                  </span>
                                </label>
                              )}

                              {perInstallment !== null && (
                                <p className="text-xs text-(--color-text-muted)">
                                  Digitou o valor total da compra?{" "}
                                  <button
                                    type="button"
                                    onClick={() => updateItem(item.key, { amount: perInstallment.toFixed(2) })}
                                    className="text-(--color-primary) underline-offset-2 hover:underline"
                                  >
                                    Usar {formatCurrency(perInstallment)} por parcela
                                  </button>
                                </p>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-(--color-text-muted)">
                            A numeração da parcela será adicionada automaticamente à descrição. As demais parcelas
                            serão lançadas automaticamente nos meses seguintes.
                          </p>
                        </>
                      )}
                    </div>
                  </>
                )}

                {item.type === "INCOME" && (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1.5 text-sm font-medium text-(--color-text)">Tipo de entrada</legend>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1">
                      {(
                        [
                          { value: false, label: "Variável" },
                          { value: true, label: "Fixa" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => updateItem(item.key, { isFixed: option.value })}
                          aria-pressed={item.isFixed === option.value}
                          className={clsx(
                            "rounded-lg py-2 text-sm font-medium transition-all duration-200",
                            item.isFixed === option.value
                              ? "bg-(--color-success) text-white shadow-sm"
                              : "text-(--color-text-muted) hover:text-(--color-text)"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-(--color-text-muted)">
                      Fixa: salário, aluguel recebido — Variável: pix de amigo, venda pontual
                    </p>
                  </fieldset>
                )}

                <TagInput
                  value={item.tags}
                  onChange={(tags) => updateItem(item.key, { tags })}
                  suggestions={tagSuggestions}
                  error={errors.tags}
                />
              </div>
            );
          })}
        </div>

        <Button type="button" variant="secondary" onClick={addItem}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar outro lançamento
        </Button>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            Salvar {totalItems} lançamento{totalItems === 1 ? "" : "s"}
          </Button>
        </div>
      </form>

      <Modal open={categoryModalOpen} title="Novo grupo" onClose={() => setCategoryModalOpen(false)}>
        <CategoryForm onDone={handleCategoryCreated} />
      </Modal>
    </>
  );
}
