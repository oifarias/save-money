"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryForm } from "@/components/groups/category-form";
import { getCategoryIcon } from "@/lib/category-icons";
import { deleteCategoryAction } from "@/app/(app)/grupos/actions";

export type CategoryWithCount = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  transactionCount: number;
};

export function CategoryManager({ categories }: { categories: CategoryWithCount[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: CategoryWithCount) {
    setEditing(category);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(deleting.id);
      if (result.success) {
        toast.success(result.message ?? "Grupo excluído");
      } else {
        toast.error(result.message ?? "Não foi possível excluir o grupo");
      }
      setDeleting(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-text)">Grupos</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Organize seus lançamentos por categoria com cores e ícones personalizados
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo grupo
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum grupo ainda</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Crie grupos para organizar seus gastos e entradas — por exemplo, Alimentação, Transporte ou Lazer.
          </p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar primeiro grupo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            return (
              <Card key={category.id} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium text-(--color-text)">{category.name}</p>
                    <p className="text-xs text-(--color-text-muted)">
                      {category.transactionCount === 0
                        ? "Nenhum lançamento"
                        : `${category.transactionCount} lançamento${category.transactionCount > 1 ? "s" : ""}`}
                      {category.isDefault && " · padrão"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    aria-label={`Editar grupo ${category.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-primary)"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(category)}
                    disabled={category.transactionCount > 0}
                    aria-label={`Excluir grupo ${category.name}`}
                    title={category.transactionCount > 0 ? "Só é possível excluir grupos vazios" : undefined}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-danger) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={formOpen} title={editing ? "Editar grupo" : "Novo grupo"} onClose={closeForm}>
        <CategoryForm category={editing ?? undefined} onDone={closeForm} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir grupo"
        description={`Tem certeza que deseja excluir o grupo "${deleting?.name}"? Essa ação não pode ser desfeita.`}
        isLoading={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
