"use client";

import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ColorPicker } from "@/components/groups/color-picker";
import { IconPicker } from "@/components/groups/icon-picker";
import { CATEGORY_ICON_SECTIONS } from "@/lib/category-icons";
import { COLOR_SECTIONS } from "@/lib/category-colors";
import { createCategoryAction, updateCategoryAction, type ActionResult } from "@/app/(app)/grupos/actions";

const DEFAULT_ICON = CATEGORY_ICON_SECTIONS[0].icons[0];

const initialState: ActionResult = { success: false };

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

      <ColorPicker
        mode="form"
        defaultValue={category?.color || COLOR_SECTIONS[0].colors[0]}
        error={state.fieldErrors?.color}
      />

      <IconPicker
        mode="form"
        defaultValue={category?.icon || DEFAULT_ICON}
        error={state.fieldErrors?.icon}
      />

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
