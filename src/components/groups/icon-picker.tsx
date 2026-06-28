"use client";

import { clsx } from "clsx";
import { CATEGORY_ICON_SECTIONS, getCategoryIcon } from "@/lib/category-icons";

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)", className)}>
      {children}
    </p>
  );
}

type IconPickerProps =
  | { mode: "form"; defaultValue: string; error?: string }
  | { mode: "controlled"; value: string; onChange: (icon: string) => void };

export function IconPicker(props: IconPickerProps) {
  if (props.mode === "form") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-(--color-text)">Ícone</legend>
        <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-xl border border-(--color-border) p-3">
          {CATEGORY_ICON_SECTIONS.map((section) => (
            <div key={section.label}>
              <SectionLabel className="mb-1.5">{section.label}</SectionLabel>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={section.label}>
                {section.icons.map((iconName) => {
                  const Icon = getCategoryIcon(iconName);
                  return (
                    <label key={iconName} className="cursor-pointer" title={iconName}>
                      <input
                        type="radio"
                        name="icon"
                        value={iconName}
                        defaultChecked={iconName === props.defaultValue}
                        className="peer sr-only"
                      />
                      <span
                        className={clsx(
                          "flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border) text-(--color-text-muted) transition-colors",
                          "peer-checked:border-(--color-primary) peer-checked:bg-(--color-primary)/12 peer-checked:text-(--color-primary)",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary)/30",
                          "hover:border-(--color-primary)/50 hover:text-(--color-text)"
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {props.error && <p className="text-xs text-(--color-danger)">{props.error}</p>}
      </fieldset>
    );
  }

  return (
    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border border-(--color-border) p-2">
      {CATEGORY_ICON_SECTIONS.map((section) => (
        <div key={section.label}>
          <SectionLabel className="mb-1">{section.label}</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {section.icons.map((iconName) => {
              const Icon = getCategoryIcon(iconName);
              return (
                <button
                  key={iconName}
                  type="button"
                  title={iconName}
                  onClick={() => props.onChange(iconName)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                    props.value === iconName
                      ? "border-(--color-primary) bg-(--color-primary)/12 text-(--color-primary)"
                      : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/50 hover:text-(--color-text)"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
