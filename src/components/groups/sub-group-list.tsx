"use client";

import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { type CategoryWithCount } from "@/components/groups/category-manager";

type SubGroupListProps = {
  items: CategoryWithCount[];
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (child: CategoryWithCount) => void;
  onDelete: (child: CategoryWithCount) => void;
};

export function SubGroupList({ items, collapsed, onToggle, onEdit, onDelete }: SubGroupListProps) {
  return (
    <div className="border-t border-(--color-border) pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-xs font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors cursor-pointer mb-2"
      >
        <span>
          {items.length} sub-grupo{items.length > 1 ? "s" : ""}
        </span>
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {!collapsed && (
        <ul className="flex flex-col gap-1.5">
          {items.map((child) => (
            <li key={child.id} className="flex items-center justify-between gap-2 pl-3 text-sm">
              <span className="text-(--color-text-muted)">— {child.name}</span>
              <div className="flex shrink-0 gap-1">
                <IconActionButton
                  icon={Pencil}
                  label={`Editar sub-grupo ${child.name}`}
                  hoverVariant="primary"
                  size="sm"
                  onClick={() => onEdit(child)}
                />
                <IconActionButton
                  icon={Trash2}
                  label={`Excluir sub-grupo ${child.name}`}
                  hoverVariant="danger"
                  size="sm"
                  disabled={child.transactionCount > 0}
                  title={child.transactionCount > 0 ? "Só é possível excluir grupos vazios" : undefined}
                  onClick={() => onDelete(child)}
                  className="disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
