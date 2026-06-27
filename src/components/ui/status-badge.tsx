import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const VARIANT_CLASSES = {
  accent:  "bg-(--color-accent)/15 text-(--color-accent)",
  primary: "bg-(--color-primary)/15 text-(--color-primary)",
  success: "bg-(--color-success)/10 text-(--color-success)",
  danger:  "bg-(--color-danger)/10 text-(--color-danger)",
  muted:   "bg-(--color-text-muted)/10 text-(--color-text-muted)",
} as const satisfies Record<string, string>;

type StatusBadgeProps = {
  label: string;
  variant?: keyof typeof VARIANT_CLASSES;
  icon?: LucideIcon;
  size?: "xs" | "sm";
};

export function StatusBadge({ label, variant = "primary", icon: Icon, size = "xs" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold",
        size === "xs" ? "px-2 py-0.5 text-[10px] uppercase tracking-wide" : "px-2.5 py-1 text-xs",
        VARIANT_CLASSES[variant]
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}
