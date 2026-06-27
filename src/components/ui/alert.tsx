import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const ALERT_VARIANTS = {
  success: { bg: "bg-(--color-success)/10",  text: "text-(--color-success)",   border: "" },
  info:    { bg: "bg-(--color-accent)/10",   text: "text-(--color-text)",       border: "" },
  warning: { bg: "bg-(--color-danger)/5",    text: "text-(--color-text)",       border: "border border-(--color-danger)/30" },
  neutral: { bg: "bg-(--color-bg)",          text: "text-(--color-text-muted)", border: "" },
  default: { bg: "bg-(--color-surface)",     text: "text-(--color-text)",       border: "border border-(--color-border)" },
} as const satisfies Record<string, { bg: string; text: string; border: string }>;

type AlertProps = {
  variant?: keyof typeof ALERT_VARIANTS;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

export function Alert({ variant = "default", icon: Icon, children, className }: AlertProps) {
  const v = ALERT_VARIANTS[variant];
  return (
    <div className={clsx("flex items-start gap-2 rounded-xl px-4 py-3 text-sm", v.bg, v.text, v.border, className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
