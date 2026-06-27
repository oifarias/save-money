"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
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

export type CategoryWithChildren = CategoryWithCount & { children: CategoryWithCount[] };

type FormMode =
  | { kind: "create" }
  | { kind: "create-sub"; parentId: string }
  | { kind: "edit"; category: CategoryWithCount; parentId: string | null };

export function CategoryManager({
  categories,
  rootCategories,
}: {
  categories: CategoryWithChildren[];
  rootCategories: { id: string; name: string }[];
}) {
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeForm() {
    setFormMode(null);
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

  const formTitle =
    formMode?.kind === "edit" ? "Editar grupo" : formMode?.kind === "create-sub" ? "Novo sub-grupo" : "Novo grupo";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grupos"
        description="Organize seus lançamentos por categoria com cores e ícones personalizados"
        action={
          <Button onClick={() => setFormMode({ kind: "create" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo grupo
          </Button>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title="Nenhum grupo ainda"
          description="Crie grupos para organizar seus gastos e entradas — por exemplo, Alimentação, Transporte ou Lazer."
          action={
            <Button onClick={() => setFormMode({ kind: "create" })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeiro grupo
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            return (
              <Card key={category.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <IconBadge icon={Icon} colorHex={category.color} />
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
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar grupo ${category.name}`}
                      hoverVariant="primary"
                      onClick={() => setFormMode({ kind: "edit", category, parentId: null })}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Excluir grupo ${category.name}`}
                      hoverVariant="danger"
                      disabled={category.transactionCount > 0}
                      title={category.transactionCount > 0 ? "Só é possível excluir grupos vazios" : undefined}
                      onClick={() => setDeleting(category)}
                      className="disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </div>
                </div>

                {category.children.length > 0 && (
                  <ul className="flex flex-col gap-1.5 border-t border-(--color-border) pt-3">
                    {category.children.map((child) => (
                      <li key={child.id} className="flex items-center justify-between gap-2 pl-3 text-sm">
                        <span className="text-(--color-text-muted)">— {child.name}</span>
                        <div className="flex shrink-0 gap-1">
                          <IconActionButton
                            icon={Pencil}
                            label={`Editar sub-grupo ${child.name}`}
                            hoverVariant="primary"
                            size="sm"
                            onClick={() => setFormMode({ kind: "edit", category: child, parentId: category.id })}
                          />
                          <IconActionButton
                            icon={Trash2}
                            label={`Excluir sub-grupo ${child.name}`}
                            hoverVariant="danger"
                            size="sm"
                            disabled={child.transactionCount > 0}
                            title={child.transactionCount > 0 ? "Só é possível excluir grupos vazios" : undefined}
                            onClick={() => setDeleting(child)}
                            className="disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setFormMode({ kind: "create-sub", parentId: category.id })}
                  className="flex items-center gap-1 self-start text-xs font-medium text-(--color-primary) hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Novo sub-grupo
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(formMode)} title={formTitle} onClose={closeForm}>
        {formMode?.kind === "edit" ? (
          <CategoryForm
            category={{ ...formMode.category, parentId: formMode.parentId }}
            rootCategories={rootCategories}
            onDone={closeForm}
          />
        ) : formMode?.kind === "create-sub" ? (
          <CategoryForm
            category={{ id: "", name: "", color: "", icon: "", parentId: formMode.parentId }}
            lockParent
            onDone={closeForm}
          />
        ) : formMode?.kind === "create" ? (
          <CategoryForm onDone={closeForm} />
        ) : null}
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
