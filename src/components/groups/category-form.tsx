"use client";

import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { CATEGORY_ICON_NAMES, getCategoryIcon } from "@/lib/category-icons";
import { createCategoryAction, updateCategoryAction, type ActionResult } from "@/app/(app)/grupos/actions";

const initialState: ActionResult = { success: false };

const SWATCHES = [
  "#1A9E6F",
  "#147A55",
  "#22C97A",
  "#F0A500",
  "#E84040",
  "#6B7A72",
  "#1C1E1D",
  "#8A9E94",
];

type CategoryFormProps = {
  category?: { id: string; name: string; color: string; icon: string; parentId?: string | null };
  rootCategories?: { id: string; name: string }[];
  /** Quando true, a categoria pai já é fixa (criação de sub-grupo a partir de um grupo específico) e não é exibida como seletor. */
  lockParent?: boolean;
  onDone: () => void;
};

export function CategoryForm({ category, rootCategories = [], lockParent = false, onDone }: CategoryFormProps) {
  const isEditing = Boolean(category?.id);
  const action = isEditing ? updateCategoryAction : createCategoryAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? "Feito!");
      onDone();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  const availableParents = rootCategories.filter((parent) => parent.id !== category?.id);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isEditing && <input type="hidden" name="id" value={category!.id} />}

      <Input
        label="Nome do grupo"
        name="name"
        defaultValue={category?.name}
        placeholder="Ex.: Pets, Viagens..."
        error={state.fieldErrors?.name}
        required
      />

      {lockParent ? (
        <input type="hidden" name="parentId" value={category?.parentId ?? ""} />
      ) : (
        availableParents.length > 0 && (
          <SelectField
            label="Categoria pai (opcional)"
            id="parentId"
            name="parentId"
            defaultValue={category?.parentId ?? ""}
            error={state.fieldErrors?.parentId}
          >
            <option value="">Nenhuma — é um grupo principal</option>
            {availableParents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </SelectField>
        )
      )}

      <ColorPicker defaultValue={category?.color || SWATCHES[0]} error={state.fieldErrors?.color} />

      <IconPicker defaultValue={category?.icon || CATEGORY_ICON_NAMES[0]} error={state.fieldErrors?.icon} />

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending}>
          {category ? "Salvar alterações" : "Criar grupo"}
        </Button>
      </div>
    </form>
  );
}

function ColorPicker({ defaultValue, error }: { defaultValue: string; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-(--color-text)">Cor</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Escolha uma cor">
        {SWATCHES.map((swatch) => (
          <label key={swatch} className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value={swatch}
              defaultChecked={swatch.toLowerCase() === defaultValue.toLowerCase()}
              className="peer sr-only"
            />
            <span
              style={{ backgroundColor: swatch }}
              className="block h-8 w-8 rounded-full ring-offset-2 ring-offset-(--color-surface) transition-all peer-checked:ring-2 peer-checked:ring-(--color-text) peer-focus-visible:ring-2"
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </fieldset>
  );
}

function IconPicker({ defaultValue, error }: { defaultValue: string; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-(--color-text)">Ícone</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Escolha um ícone">
        {CATEGORY_ICON_NAMES.map((iconName) => {
          const Icon = getCategoryIcon(iconName);
          return (
            <label key={iconName} className="cursor-pointer">
              <input
                type="radio"
                name="icon"
                value={iconName}
                defaultChecked={iconName === defaultValue}
                className="peer sr-only"
              />
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-muted) transition-colors",
                  "peer-checked:border-(--color-primary) peer-checked:bg-(--color-primary)/12 peer-checked:text-(--color-primary)",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary)/30"
                )}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </fieldset>
  );
}
