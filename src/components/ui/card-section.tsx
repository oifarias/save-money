import { type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

type CardSectionProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  colorToken?: string;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
};

export function CardSection({
  icon,
  title,
  subtitle,
  colorToken = "--color-primary",
  empty = false,
  emptyMessage = "Ainda não há dados suficientes.",
  children,
  className,
}: CardSectionProps) {
  return (
    <Card className={clsx("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2.5">
        <IconBadge icon={icon} size="sm" colorToken={colorToken} />
        <div>
          <h3 className="font-display text-base font-semibold text-(--color-text)">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-(--color-text-muted)">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <p className="py-4 text-center text-sm text-(--color-text-muted)">{emptyMessage}</p>
      ) : (
        children
      )}
    </Card>
  );
}
