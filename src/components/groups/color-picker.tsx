"use client";

import { clsx } from "clsx";
import { COLOR_SECTIONS } from "@/lib/category-colors";

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)", className)}>
      {children}
    </p>
  );
}

type ColorPickerProps =
  | { mode: "form"; defaultValue: string; error?: string }
  | { mode: "controlled"; value: string; onChange: (color: string) => void };

export function ColorPicker(props: ColorPickerProps) {
  if (props.mode === "form") {
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-(--color-text)">Cor</legend>
        <div className="flex flex-col gap-2 rounded-xl border border-(--color-border) p-3">
          {COLOR_SECTIONS.map((section) => (
            <div key={section.label}>
              <SectionLabel className="mb-1.5">{section.label}</SectionLabel>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={section.label}>
                {section.colors.map((swatch) => (
                  <label key={swatch} className="cursor-pointer" title={swatch}>
                    <input
                      type="radio"
                      name="color"
                      value={swatch}
                      defaultChecked={swatch.toLowerCase() === props.defaultValue.toLowerCase()}
                      className="peer sr-only"
                    />
                    <span
                      style={{ backgroundColor: swatch }}
                      className="block h-7 w-7 rounded-full ring-offset-2 ring-offset-(--color-surface) transition-all peer-checked:ring-2 peer-checked:ring-(--color-text) peer-focus-visible:ring-2"
                      aria-hidden="true"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {props.error && <p className="text-xs text-(--color-danger)">{props.error}</p>}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {COLOR_SECTIONS.map((section) => (
        <div key={section.label}>
          <SectionLabel className="mb-1">{section.label}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {section.colors.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => props.onChange(swatch)}
                style={{ backgroundColor: swatch }}
                className={clsx(
                  "h-7 w-7 rounded-full ring-offset-2 ring-offset-(--color-surface) transition-all",
                  props.value.toLowerCase() === swatch.toLowerCase() && "ring-2 ring-(--color-text)"
                )}
                aria-label={swatch}
                title={swatch}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
