"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  level?: "h2" | "h3";
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  level: Tag = "h2",
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <Tag className="font-display text-xl font-semibold text-(--color-text)">{title}</Tag>
          {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
        </div>
        <ChevronDown
          className={clsx(
            "h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={clsx(
          "flex flex-col gap-4 overflow-hidden transition-all duration-200",
          open ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
