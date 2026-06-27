import { ButtonHTMLAttributes } from "react";
import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const HOVER_VARIANTS = {
  primary: "hover:text-(--color-primary)",
  danger:  "hover:text-(--color-danger)",
  default: "hover:text-(--color-text)",
} as const satisfies Record<string, string>;

const SIZE_CLASSES = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
} as const satisfies Record<string, string>;

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  hoverVariant?: keyof typeof HOVER_VARIANTS;
  size?: keyof typeof SIZE_CLASSES;
};

export function IconActionButton({
  icon: Icon,
  label,
  hoverVariant = "default",
  size = "md",
  className,
  ...props
}: IconActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(
        "flex items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg)",
        SIZE_CLASSES[size],
        HOVER_VARIANTS[hoverVariant],
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
