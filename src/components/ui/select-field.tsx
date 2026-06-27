import { SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
};

export function SelectField({ label, error, hint, id, className, children, ...props }: SelectFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
          {label}
        </label>
        {hint}
      </div>
      <select
        id={inputId}
        className={clsx(
          "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors",
          "focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p role="alert" className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
