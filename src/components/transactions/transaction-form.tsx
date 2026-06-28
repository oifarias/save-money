"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { TagInput } from "@/components/transactions/tag-input";
import { CategoryForm } from "@/components/groups/category-form";
import { formatCurrency } from "@/lib/format";
import {
  createTransactionAction,
  updateTransactionAction,
  type ActionResult,
} from "@/app/(app)/lancamentos/actions";

const initialState: ActionResult = { success: false };

export type TransactionFormCategory = { id: string; name: string; children: { id: string; name: string }[] };

export type TransactionFormValues = {
  id: string;
  type: "EXPENSE" | "INCOME";
  date: string;
  description: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  isFixed: boolean;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  tags: string[];
  installmentNumber?: number;
  installmentTotal?: number;
};

type TransactionFormProps = {
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  transaction?: TransactionFormValues;
  onDone: () => void;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ categories, tagSuggestions, transaction, onDone }: TransactionFormProps) {
  const router = useRouter();
  const action = transaction ? updateTransactionAction : createTransactionAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] = useState<"EXPENSE" | "INCOME">(transaction?.type ?? "EXPENSE");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [isInstallment, setIsInstallment] = useState(false);
  const [isFixedIncome, setIsFixedIncome] = useState<boolean>(
    transaction?.type === "INCOME" ? (transaction.isFixed ?? false) : false
  );
  const [amount, setAmount] = useState(transaction?.amount ?? "");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [createPastInstallments, setCreatePastInstallments] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const subcategoryOptions = selectedCategory?.children ?? [];

  const amountNum = parseFloat(amount);
  const totalNum = parseInt(totalInstallments, 10);
  const startNum = parseInt(currentInstallment, 10) || 1;
  const pastCount = startNum > 1 ? startNum - 1 : 0;
  const perInstallment = amountNum > 0 && !isNaN(amountNum) && totalNum >= 2 ? amountNum / totalNum : null;
  const creatingCount = totalNum >= 2 && startNum >= 1 && startNum <= totalNum ? totalNum - startNum + 1 : null;
  const effectiveStartInstallment = createPastInstallments && startNum > 1 ? "1" : currentInstallment;

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? "Feito!");
      router.refresh();
      onDone();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onDone, router]);

  function handleCategoryCreated() {
    setCategoryModalOpen(false);
    router.refresh();
    toast("Selecione o novo grupo na lista após a atualização", { icon: "💡" });
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        {transaction && <input type="hidden" name="id" value={transaction.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="recurrence" value={transaction?.recurrence ?? "NONE"} />

        <ToggleGroup
          legend="Tipo"
          value={type}
          onChange={(val) => {
            setType(val);
            if (val === "INCOME") setIsInstallment(false);
          }}
          options={[
            { value: "EXPENSE" as const, label: "Despesa", activeColor: "--color-danger" },
            { value: "INCOME" as const, label: "Entrada", activeColor: "--color-success" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Data"
            name="date"
            type="date"
            defaultValue={transaction?.date ?? todayISODate()}
            error={state.fieldErrors?.date}
            required
          />
          <Input
            label="Valor (R$)"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={state.fieldErrors?.amount}
            className="font-numeric"
            required
          />
        </div>

        <Input
          label="Descrição"
          name="description"
          type="text"
          placeholder="Ex.: Almoço no shopping"
          defaultValue={transaction?.description}
          error={state.fieldErrors?.description}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Grupo"
            name="categoryId"
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            hint={
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-(--color-primary) hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Novo grupo
              </button>
            }
          >
            <option value="">Sem grupo</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            key={categoryId}
            label="Sub-grupo"
            name="subcategoryId"
            id="subcategoryId"
            defaultValue={categoryId === transaction?.categoryId ? transaction?.subcategoryId ?? "" : ""}
            disabled={subcategoryOptions.length === 0}
          >
            <option value="">Sem sub-grupo</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </SelectField>
        </div>

        {type === "EXPENSE" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5 transition-colors has-[:checked]:border-(--color-primary) has-[:checked]:ring-1 has-[:checked]:ring-(--color-primary)">
            <input
              type="checkbox"
              name="isFixed"
              defaultChecked={transaction?.isFixed}
              className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-(--color-text)">Despesa fixa</span>
              <span className="text-xs text-(--color-text-muted)">
               Marque essa opção para que ela apareça todo mês na checklist de despesas fixas leve em consideração despesas que se repetem todo mês.
                     
              </span>
            </div>
          </label>
        )}

        {type === "INCOME" && (
          <div className="flex flex-col gap-1.5">
            <ToggleGroup
              legend="Tipo de entrada"
              value={isFixedIncome ? "true" : "false"}
              onChange={(val) => setIsFixedIncome(val === "true")}
              options={[
                { value: "false" as const, label: "Variável", activeColor: "--color-success" },
                { value: "true" as const, label: "Fixa", activeColor: "--color-success" },
              ]}
            />
            <p className="text-xs text-(--color-text-muted)">
              Fixa: salário, aluguel recebido — Variável: pix de amigo, venda pontual
            </p>
            {isFixedIncome && <input type="hidden" name="isFixed" value="on" />}
          </div>
        )}

        {transaction?.installmentNumber && (
          <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5">
            <p className="text-sm text-(--color-text-muted)">
              Parcela{" "}
              <strong className="text-(--color-text)">
                {transaction.installmentNumber}
                {transaction.installmentTotal ? ` de ${transaction.installmentTotal}` : ""}
              </strong>
              {" "}deste parcelamento
            </p>
            {(transaction.installmentTotal ?? 0) > 1 && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  name="propagateToAll"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-(--color-primary)"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-(--color-text)">
                    Aplicar nas {(transaction.installmentTotal ?? 1) - 1} outra{(transaction.installmentTotal ?? 1) - 1 !== 1 ? "s" : ""} parcela{(transaction.installmentTotal ?? 1) - 1 !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-(--color-text-muted)">
                    Valor, descrição, categoria e hashtags serão atualizados em todo o parcelamento
                  </span>
                </div>
              </label>
            )}
          </div>
        )}

        {type === "EXPENSE" && !transaction && (
          <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="isInstallment"
                checked={isInstallment}
                onChange={(event) => setIsInstallment(event.target.checked)}
                className="h-4 w-4 rounded accent-(--color-primary)"
              />
              <span className="text-sm font-medium text-(--color-text)">Esta despesa é parcelada?</span>
            </label>

            {!isInstallment && (
              <p className="text-xs text-(--color-text-muted)">
                Marque se esta despesa será paga em mais de uma parcela
              </p>
            )}

            {isInstallment && (
              <>
                <input type="hidden" name="currentInstallment" value={effectiveStartInstallment} />

                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <Input
                    label="Parcela nº"
                    type="number"
                    min="1"
                    max={totalInstallments || "360"}
                    placeholder="1"
                    value={currentInstallment}
                    onChange={(e) => {
                      setCurrentInstallment(e.target.value);
                      setCreatePastInstallments(false);
                    }}
                    error={state.fieldErrors?.currentInstallment}
                  />
                  <span className="pb-2.5 text-sm text-(--color-text-muted)">de</span>
                  <Input
                    label="Total"
                    name="totalInstallments"
                    type="number"
                    min="2"
                    max="360"
                    step="1"
                    placeholder="Ex.: 5"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    error={state.fieldErrors?.totalInstallments}
                    required
                  />
                </div>

                {totalNum >= 2 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-(--color-border) px-3.5 py-3">
                    <p className="text-sm text-(--color-text)">
                      {createPastInstallments && pastCount > 0 ? (
                        <>Vamos criar <strong>{totalNum} parcelas</strong> — <strong>{pastCount}</strong> no passado e <strong>{creatingCount}</strong> nos próximos meses</>
                      ) : creatingCount !== null && creatingCount < totalNum ? (
                        <>Vamos criar <strong>{creatingCount} parcela{creatingCount !== 1 ? "s" : ""}</strong> ({startNum}/{totalNum} até {totalNum}/{totalNum}) nos próximos meses</>
                      ) : (
                        <>Vamos criar <strong>{totalNum} parcelas</strong> nos próximos meses</>
                      )}
                      {amountNum > 0 ? <>, de <strong>{formatCurrency(amountNum)}</strong> cada</> : null}.
                    </p>

                    {pastCount > 0 && (
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={createPastInstallments}
                          onChange={(e) => setCreatePastInstallments(e.target.checked)}
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
                          onClick={() => setAmount(perInstallment.toFixed(2))}
                          className="text-(--color-primary) underline-offset-2 hover:underline"
                        >
                          Usar {formatCurrency(perInstallment)} por parcela
                        </button>
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-(--color-text-muted)">
                  A numeração da parcela será adicionada automaticamente à descrição. As demais parcelas serão
                  lançadas automaticamente nos meses seguintes, com a mesma categoria, sub-grupo e hashtags.
                </p>
              </>
            )}
          </div>
        )}

        <TagInput
          name="tags"
          defaultTags={transaction?.tags ?? []}
          suggestions={tagSuggestions}
          error={state.fieldErrors?.tags}
        />

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            {transaction ? "Salvar alterações" : "Adicionar lançamento"}
          </Button>
        </div>
      </form>

      <Modal open={categoryModalOpen} title="Novo grupo" onClose={() => setCategoryModalOpen(false)}>
        <CategoryForm onDone={handleCategoryCreated} />
      </Modal>
    </>
  );
}
