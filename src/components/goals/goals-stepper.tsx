import { Check } from "lucide-react";
import { clsx } from "clsx";

const STEPS = [
  { id: "income", label: "Renda mensal" },
  { id: "allocation", label: "Divisão da renda" },
  { id: "categories", label: "Valor por grupo" },
] as const;

export function GoalsStepper({ current }: { current: (typeof STEPS)[number]["id"] }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="flex items-center" aria-label="Etapas para criar suas metas">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.id} className={clsx("flex items-center", index < STEPS.length - 1 && "flex-1")}>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted
                    ? "bg-(--color-primary) text-white"
                    : isCurrent
                      ? "border-2 border-(--color-primary) text-(--color-primary)"
                      : "border border-(--color-border) text-(--color-text-muted)"
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={clsx(
                  "hidden text-xs font-medium sm:inline",
                  isCurrent ? "text-(--color-text)" : "text-(--color-text-muted)"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-(--color-border)" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
