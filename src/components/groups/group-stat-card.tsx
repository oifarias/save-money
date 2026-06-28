import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type CardClasses } from "@/components/dashboard/summary-cards";

type GroupStatCardProps = {
  icon: LucideIcon;
  title: string;
  count: number;
  description: string;
  classes: CardClasses;
  onClick?: () => void;
  disabled?: boolean;
};

export function GroupStatCard({
  icon: Icon,
  title,
  count,
  description,
  classes,
  onClick,
  disabled,
}: GroupStatCardProps) {
  const inner = (
    <Card
      className={`flex flex-col gap-1 p-2 ${classes.border} ${classes.gradient} transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium uppercase tracking-wide ${classes.text}`}>{title}</p>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${classes.iconBg} ${classes.text}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="font-numeric text-2xl font-semibold text-(--color-text)">{count}</p>
      <div className={`border-t ${classes.divider}`} />
      <p className="text-xs text-(--color-text-muted)">{description}</p>
    </Card>
  );

  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className="w-full cursor-pointer text-left">
        {inner}
      </button>
    );
  }

  return <div>{inner}</div>;
}
