"use client";

import { clsx } from "clsx";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  title?: string;
  className?: string;
};

export function Switch({ checked, onChange, disabled, label, title, className }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed",
        checked ? "bg-(--color-primary)" : "bg-(--color-border)",
        className
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    // <button> é um elemento "labelable": o navegador encaminha automaticamente o
    // clique no <label> (inclusive no texto) para o botão aninhado — sem precisar
    // de onClick duplicado aqui, o que evitaria disparar o toggle duas vezes.
    <label
      title={title}
      className={clsx(
        "flex items-center gap-2 text-sm text-(--color-text)",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      {control}
      {label}
    </label>
  );
}
