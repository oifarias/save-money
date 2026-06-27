import { clsx } from "clsx";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
  activeColor?: string;
};

type ToggleGroupProps<T extends string> = {
  legend?: string;
  value: T;
  onChange: (value: T) => void;
  options: ToggleOption<T>[];
  columns?: 2 | 3 | 4;
};

const COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const satisfies Record<number, string>;

export function ToggleGroup<T extends string>({
  legend,
  value,
  onChange,
  options,
  columns = 2,
}: ToggleGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      {legend && <legend className="text-sm font-medium text-(--color-text)">{legend}</legend>}
      <div className={clsx("grid gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1", COLS[columns])}>
        {options.map((option) => {
          const active = value === option.value;
          const color = option.activeColor ?? "--color-primary";
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={clsx(
                "rounded-lg py-2 text-sm font-medium transition-all duration-200",
                active
                  ? `bg-(${color}) text-white shadow-sm`
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
