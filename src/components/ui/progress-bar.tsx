import { clsx } from "clsx";

const COLOR_CLASSES = {
  primary: "bg-(--color-primary)",
  success: "bg-(--color-success)",
  danger:  "bg-(--color-danger)",
  accent:  "bg-(--color-accent)",
} as const satisfies Record<string, string>;

const HEIGHT_CLASSES = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3",
} as const satisfies Record<string, string>;

type ProgressBarProps = {
  value: number;
  color?: keyof typeof COLOR_CLASSES;
  height?: keyof typeof HEIGHT_CLASSES;
  showMilestones?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  color = "primary",
  height = "md",
  showMilestones = false,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const h = HEIGHT_CLASSES[height];
  return (
    <div className={clsx("relative w-full overflow-hidden rounded-full bg-(--color-bg)", h, className)}>
      <div
        className={clsx("h-full rounded-full transition-all duration-300", COLOR_CLASSES[color])}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      {showMilestones &&
        [25, 50, 75].map((m) => (
          <span
            key={m}
            className={clsx("absolute top-0 w-px bg-(--color-surface)/70", h)}
            style={{ left: `${m}%` }}
            aria-hidden="true"
          />
        ))}
    </div>
  );
}
