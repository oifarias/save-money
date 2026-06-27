import { clsx } from "clsx";
import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={clsx("flex flex-col items-center gap-2 py-12 text-center", className)}>
      <p className="font-display text-lg font-semibold text-(--color-text)">{title}</p>
      {description && <p className="max-w-sm text-sm text-(--color-text-muted)">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
