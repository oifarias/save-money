import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white shadow-sm hover:brightness-105 active:brightness-95",
  secondary:
    "bg-(--color-surface) text-(--color-text) border border-(--color-border) hover:border-(--color-primary)",
  ghost: "bg-transparent text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface)",
  danger: "bg-(--color-danger) text-white hover:brightness-105",
  link: "bg-transparent px-0! py-0! text-xs font-medium text-(--color-primary) underline-offset-2 hover:underline",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
