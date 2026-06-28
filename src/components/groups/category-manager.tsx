"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Layers, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryForm } from "@/components/groups/category-form";
import { BatchEditModal } from "@/components/groups/batch-edit-modal";
import { SubGroupList } from "@/components/groups/sub-group-list";
import { GroupRenameModal } from "@/components/groups/group-rename-modal";
import { SubGroupRenameModal } from "@/components/groups/sub-group-rename-modal";
import { GroupStatCard } from "@/components/groups/group-stat-card";
import { CARD_COLORS } from "@/components/dashboard/summary-cards";
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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(categories.map((c) => c.id)));
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameSubModalOpen, setRenameSubModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalSubGroups = categories.reduce((sum, c) => sum + c.children.length, 0);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          <div className="flex gap-2">
            {categories.length > 0 && (
              <Button variant="secondary" onClick={() => setBatchEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar em lote
              </Button>
            )}
            <Button onClick={() => setFormMode({ kind: "create" })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo grupo
            </Button>
          </div>
        }
      />

      {categories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GroupStatCard
            icon={Tags}
            title="Grupos"
            count={categories.length}
            description="Organize e categorize seus lançamentos para visualizar onde seu dinheiro vai."
            classes={CARD_COLORS.accent}
            onClick={() => setRenameModalOpen(true)}
          />
          <GroupStatCard
            icon={Layers}
            title="Sub-grupos"
            count={totalSubGroups}
            description="Subdivida grupos para um controle ainda mais detalhado dos seus gastos."
            classes={CARD_COLORS.blue}
            onClick={totalSubGroups > 0 ? () => setRenameSubModalOpen(true) : undefined}
            disabled={totalSubGroups === 0}
          />
        </div>
      )}

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            return (
              <Card key={category.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <IconBadge icon={Icon} colorHex={category.color} />
                    <div>
                      <p className="font-medium text-(--color-text)">{category.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-(--color-text-muted)">
                          {category.transactionCount === 0
                            ? "Nenhum lançamento"
                            : `${category.transactionCount} lançamento${category.transactionCount > 1 ? "s" : ""}`}
                        </span>
                        {category.isDefault && <StatusBadge label="padrão" variant="muted" />}
                      </div>
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
                  <SubGroupList
                    items={category.children}
                    collapsed={collapsed.has(category.id)}
                    onToggle={() => toggleCollapse(category.id)}
                    onEdit={(child) => setFormMode({ kind: "edit", category: child, parentId: category.id })}
                    onDelete={(child) => setDeleting(child)}
                  />
                )}

                <Button
                  variant="link"
                  className="self-start gap-1!"
                  onClick={() => setFormMode({ kind: "create-sub", parentId: category.id })}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Novo sub-grupo
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(formMode)} title={formTitle} onClose={() => setFormMode(null)}>
        {formMode?.kind === "edit" ? (
          <CategoryForm
            category={{ ...formMode.category, parentId: formMode.parentId }}
            rootCategories={rootCategories}
            onDone={() => setFormMode(null)}
          />
        ) : formMode?.kind === "create-sub" ? (
          <CategoryForm
            category={{ id: "", name: "", color: "", icon: "", parentId: formMode.parentId }}
            lockParent
            onDone={() => setFormMode(null)}
          />
        ) : formMode?.kind === "create" ? (
          <CategoryForm onDone={() => setFormMode(null)} />
        ) : null}
      </Modal>

      <BatchEditModal
        categories={categories}
        open={batchEditOpen}
        onClose={() => setBatchEditOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir grupo"
        description={`Tem certeza que deseja excluir o grupo "${deleting?.name}"? Essa ação não pode ser desfeita.`}
        isLoading={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <GroupRenameModal
        categories={categories}
        open={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
      />

      <SubGroupRenameModal
        categories={categories}
        open={renameSubModalOpen}
        onClose={() => setRenameSubModalOpen(false)}
      />
    </div>
  );
}
