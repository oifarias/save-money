import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { clsx } from "clsx";
import type { Insight } from "@/lib/dashboard-data";

const TONE_CONFIG = {
  info: { icon: Lightbulb, tone: "text-(--color-primary)", bg: "bg-(--color-primary)/10" },
  warning: { icon: AlertTriangle, tone: "text-(--color-accent)", bg: "bg-(--color-accent)/12" },
  success: { icon: CheckCircle2, tone: "text-(--color-success)", bg: "bg-(--color-success)/10" },
} as const;

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Insights automáticos</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Análises geradas com base nos seus próprios dados</p>

      {insights.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-center text-sm text-(--color-text-muted)">
          Registre alguns lançamentos para começar a receber insights personalizados
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {insights.map((insight) => {
            const config = TONE_CONFIG[insight.tone];
            const Icon = config.icon;
            return (
              <li key={insight.id} className="flex gap-3 rounded-xl border border-(--color-border) p-3.5">
                <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", config.bg, config.tone)}>
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-(--color-text)">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">{insight.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
