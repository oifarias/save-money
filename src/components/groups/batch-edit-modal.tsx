"use client";

import { useState, useTransition, useEffect } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ColorPicker } from "@/components/groups/color-picker";
import { IconPicker } from "@/components/groups/icon-picker";
import { getCategoryIcon } from "@/lib/category-icons";
import { batchUpdateCategoriesAction, type BatchUpdateItem } from "@/app/(app)/grupos/actions";
import { type CategoryWithCount } from "@/components/groups/category-manager";

type BatchEditModalProps = {
  categories: CategoryWithCount[];
  open: boolean;
  onClose: () => void;
};

export function BatchEditModal({ categories, open, onClose }: BatchEditModalProps) {
  const [items, setItems] = useState<BatchUpdateItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          Edite nome, cor e ícone de cada grupo. Clique em &ldquo;Personalizar&rdquo; para alterar cor e ícone.
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
                      <ColorPicker mode="controlled" value={item.color} onChange={(color) => updateItem(item.id, { color })} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-(--color-text-muted)">Ícone</p>
                      <IconPicker mode="controlled" value={item.icon} onChange={(icon) => updateItem(item.id, { icon })} />
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
