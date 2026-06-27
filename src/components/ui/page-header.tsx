import { clsx } from "clsx";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  level?: "h1" | "h2" | "h3";
  className?: string;
};

export function PageHeader({ title, description, action, level = "h1", className }: PageHeaderProps) {
  const Tag = level;
  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <div>
        <Tag className="font-display text-2xl font-semibold text-(--color-text)">{title}</Tag>
        {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
