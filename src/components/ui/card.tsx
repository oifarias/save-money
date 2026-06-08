import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-fade-grow",
        className
      )}
      {...props}
    />
  );
}
