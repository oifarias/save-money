import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type ComingSoonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">{title}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>
      </div>
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="font-display text-lg font-semibold text-(--color-text)">Em breve</p>
        <p className="max-w-sm text-sm text-(--color-text-muted)">
          Esta seção está em desenvolvimento e fará parte das próximas entregas do Save Money.
        </p>
      </Card>
    </div>
  );
}
