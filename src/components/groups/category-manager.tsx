"use client";

import { useState, useTransition, useEffect } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { CategoryForm } from "@/components/groups/category-form";
import { getCategoryIcon, CATEGORY_ICON_SECTIONS } from "@/lib/category-icons";
import { COLOR_SECTIONS } from "@/lib/category-colors";
import { deleteCategoryAction, batchUpdateCategoriesAction, type BatchUpdateItem } from "@/app/(app)/grupos/actions";

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

function BatchColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {COLOR_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
            {section.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {section.colors.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChange(swatch)}
                style={{ backgroundColor: swatch }}
                className={clsx(
                  "h-7 w-7 rounded-full ring-offset-2 ring-offset-(--color-surface) transition-all",
                  value.toLowerCase() === swatch.toLowerCase() && "ring-2 ring-(--color-text)"
                )}
                aria-label={swatch}
                title={swatch}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BatchIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border border-(--color-border) p-2">
      {CATEGORY_ICON_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)">{section.label}</p>
          <div className="flex flex-wrap gap-1">
            {section.icons.map((iconName) => {
              const Icon = getCategoryIcon(iconName);
              return (
                <button
                  key={iconName}
                  type="button"
                  title={iconName}
                  onClick={() => onChange(iconName)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                    value === iconName
                      ? "border-(--color-primary) bg-(--color-primary)/12 text-(--color-primary)"
                      : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/50 hover:text-(--color-text)"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function BatchEditModal({
  categories,
  open,
  onClose,
}: {
  categories: CategoryWithCount[];
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<BatchUpdateItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setItems(categories.map((c) => ({ id: c.id, name: c.name, color: c.color, icon: c.icon })));
      setExpandedId(null);
    }
  }, [open, categories]);

  function updateItem(id: string, patch: Partial<BatchUpdateItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await batchUpdateCategoriesAction(items);
      if (result.success) {
        toast.success(result.message ?? "Grupos atualizados");
        onClose();
      } else {
        toast.error(result.message ?? "Não foi possível salvar");
      }
    });
  }

  return (
    <Modal open={open} title="Editar grupos em lote" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--color-text-muted)">
          Edite nome, cor e ícone de cada grupo. Clique em "Personalizar" para alterar cor e ícone.
        </p>

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {items.map((item) => {
            const Icon = getCategoryIcon(item.icon);
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className="rounded-xl border border-(--color-border) bg-(--color-bg)">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: item.color + "22", color: item.color }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    className="py-1.5 text-sm"
                    placeholder="Nome do grupo"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="shrink-0 text-xs font-medium text-(--color-primary) hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        Fechar
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        Personalizar
                      </>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="flex flex-col gap-3 border-t border-(--color-border) px-3 pb-3 pt-2.5">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-(--color-text-muted)">Cor</p>
                      <BatchColorPicker value={item.color} onChange={(color) => updateItem(item.id, { color })} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-(--color-text-muted)">Ícone</p>
                      <BatchIconPicker value={item.icon} onChange={(icon) => updateItem(item.id, { icon })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 border-t border-(--color-border) pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} isLoading={isPending}>
            Salvar alterações
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  const [isPending, startTransition] = useTransition();

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
                  <div className="border-t border-(--color-border) pt-3">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(category.id)}
                      className="flex w-full items-center justify-between gap-2 text-xs font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors cursor-pointer mb-2"
                    >
                      <span>
                        {category.children.length} sub-grupo{category.children.length > 1 ? "s" : ""}
                      </span>
                      {collapsed.has(category.id) ? (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    {!collapsed.has(category.id) && (
                      <ul className="flex flex-col gap-1.5">
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
                  </div>
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
    </div>
  );
}
