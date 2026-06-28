"use client";

import { useState, useEffect, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { batchUpdateCategoriesAction } from "@/app/(app)/grupos/actions";
import type { CategoryWithChildren } from "@/components/groups/category-manager";

type SubRenameItem = {
  id: string;
  name: string;
  originalName: string;
  color: string;
  icon: string;
  parentId: string;
  parentName: string;
};

type SubGroupRenameModalProps = {
  categories: CategoryWithChildren[];
  open: boolean;
  onClose: () => void;
};

export function SubGroupRenameModal({ categories, open, onClose }: SubGroupRenameModalProps) {
  const [items, setItems] = useState<SubRenameItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputDraft, setInputDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(
        categories.flatMap((category) =>
          category.children.map((child) => ({
            id: child.id,
            name: child.name,
            originalName: child.name,
            color: child.color,
            icon: child.icon,
            parentId: category.id,
            parentName: category.name,
          }))
        )
      );
      setEditingId(null);
      setInputDraft("");
    }
  }, [open, categories]);

  function startEdit(id: string, currentName: string) {
    setEditingId(id);
    setInputDraft(currentName);
  }

  function confirmEdit() {
    if (!editingId) return;
    const trimmed = inputDraft.trim();
    if (trimmed) {
      setItems((prev) =>
        prev.map((item) => (item.id === editingId ? { ...item, name: trimmed } : item))
      );
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleSave() {
    const modified = items.filter((item) => item.name.trim() !== item.originalName);
    if (modified.length === 0) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await batchUpdateCategoriesAction(
        modified.map((item) => ({
          id: item.id,
          name: item.name.trim().toUpperCase(),
          color: item.color,
          icon: item.icon,
        }))
      );
      if (result.success) {
        toast.success(result.message ?? "Sub-grupos renomeados");
        onClose();
      } else {
        toast.error(result.message ?? "Não foi possível salvar");
      }
    });
  }

  // Group items by parentName, preserving insertion order
  const groups = items.reduce<{ parentName: string; entries: SubRenameItem[] }[]>((acc, item) => {
    const existing = acc.find((g) => g.parentName === item.parentName);
    if (existing) {
      existing.entries.push(item);
    } else {
      acc.push({ parentName: item.parentName, entries: [item] });
    }
    return acc;
  }, []);

  return (
    <Modal open={open} title="Renomear sub-grupos" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-(--color-text-muted)">
          Duplo clique em um sub-grupo para renomear.
        </p>

        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.parentName} className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
                {group.parentName}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.entries.map((item) => {
                  const isEditing = editingId === item.id;
                  const isModified = item.name !== item.originalName;

                  if (isEditing) {
                    return (
                      <input
                        key={item.id}
                        autoFocus
                        value={inputDraft}
                        onChange={(e) => setInputDraft(e.target.value)}
                        onBlur={confirmEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className="rounded-full border border-(--color-primary) bg-(--color-surface) px-3 py-1 text-sm text-(--color-text) outline-none ring-2 ring-(--color-primary)/20"
                        style={{ width: `${Math.max(inputDraft.length + 4, 10)}ch` }}
                      />
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      title="Duplo clique para renomear"
                      onDoubleClick={() => startEdit(item.id, item.name)}
                      className={[
                        "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                        isModified
                          ? "border-(--color-primary) bg-(--color-bg) text-(--color-text)"
                          : "border-(--color-border) bg-(--color-bg) text-(--color-text)",
                      ].join(" ")}
                    >
                      <span>{item.name}</span>
                      {isModified && (
                        <Pencil size={11} className="text-(--color-text-muted)" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-(--color-border) pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isPending}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
