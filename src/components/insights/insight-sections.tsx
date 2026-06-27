import { AlertTriangle, CalendarClock, Hash, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency } from "@/lib/format";
import { FixedExpenseCandidatesList, FixedExpenseResolvedList } from "@/components/insights/fixed-expense-candidate-card";
import type {
  CategoryAverageComparison,
  CategoryGrowth,
  FixedExpenseAlert,
  FixedExpenseCandidate,
  FixedExpenseResolvedInsight,
  HashtagRanking,
  InstallmentForecast,
  ReductionSuggestion,
} from "@/lib/insights-data";

function EmptySection({ message }: { message: string }) {
  return <p className="mt-4 text-center text-sm text-(--color-text-muted)">{message}</p>;
}

function VariationBadge({ value }: { value: number }) {
  const isUp = value > 0;
  const isFlat = value === 0;
  const label = `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <StatusBadge
      label={label}
      variant={isFlat ? "muted" : isUp ? "danger" : "success"}
      icon={isFlat ? undefined : isUp ? TrendingUp : TrendingDown}
      size="sm"
    />
  );
}

export function GrowthRankingCard({ data, windowLabel }: { data: CategoryGrowth[]; windowLabel: { from: string; to: string } }) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Maior crescimento de gastos</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">
        Comparação entre {windowLabel.from} e {windowLabel.to} (últimos 3 meses)
      </p>

      {data.length === 0 ? (
        <EmptySection message="Ainda não há dados suficientes para calcular tendências de crescimento" />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) p-3.5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-(--color-text)">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">
                    {formatCurrency(entry.pastValue)} → {formatCurrency(entry.currentValue)}
                  </p>
                </div>
              </div>
              <VariationBadge value={entry.growthPercent} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CategoryAveragesCard({ data, windowLabel }: { data: CategoryAverageComparison[]; windowLabel: string }) {
  return (
    <Card className="overflow-x-auto">
      <h3 className="font-display text-base font-semibold text-(--color-text)">Média mensal por grupo vs. mês atual</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Histórico considerado: {windowLabel}</p>

      {data.length === 0 ? (
        <EmptySection message="Registre lançamentos em mais meses para calcular médias por grupo" />
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-xs uppercase tracking-wide text-(--color-text-muted)">
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2 text-right">Média histórica</th>
              <th className="px-3 py-2 text-right">Mês atual</th>
              <th className="px-3 py-2 text-right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.id} className="border-b border-(--color-border) last:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-(--color-text)">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    {entry.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-numeric text-(--color-text-muted)">{formatCurrency(entry.average)}</td>
                <td className="px-3 py-2 text-right font-numeric text-(--color-text)">{formatCurrency(entry.current)}</td>
                <td className="px-3 py-2 text-right">
                  <VariationBadge value={entry.deltaPercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function ReductionSuggestionsCard({ data }: { data: ReductionSuggestion[] }) {
  return (
    <CardSection
      icon={Sprout}
      title="Metas de redução sugeridas"
      subtitle="Baseado nos grupos mais pesados do mês — meta de 10% de corte"
      empty={data.length === 0}
      emptyMessage="Registre despesas para receber sugestões de metas de redução"
    >
      <ul className="flex flex-col gap-4">
        {data.map((entry) => {
          const targetShare = entry.currentSpend > 0 ? (entry.targetSpend / entry.currentSpend) * 100 : 0;
          return (
            <li key={entry.id} className="rounded-xl border border-(--color-border) p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-(--color-text)">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                  {entry.name}
                </span>
                <span className="text-xs text-(--color-text-muted)">
                  Atual: <span className="font-numeric text-(--color-text)">{formatCurrency(entry.currentSpend)}</span>
                </span>
              </div>
              <ProgressBar value={Math.min(100, Math.max(0, targetShare))} color="primary" className="mt-3" />
              <p className="mt-2 text-xs text-(--color-text-muted)">
                Reduza <span className="font-medium text-(--color-text)">{formatCurrency(entry.suggestedCut)}</span> e chegue a
                uma meta mensal de{" "}
                <span className="font-numeric font-medium text-(--color-primary)">{formatCurrency(entry.targetSpend)}</span> em{" "}
                {entry.name}.
              </p>
            </li>
          );
        })}
      </ul>
    </CardSection>
  );
}

export function HashtagRankingCard({ data }: { data: HashtagRanking[] }) {
  const max = data[0]?.total ?? 0;

  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Hashtags que mais concentram gastos</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Ranking do mês atual por valor total</p>

      {data.length === 0 ? (
        <EmptySection message="Use hashtags nos seus lançamentos para descobrir onde seu dinheiro se concentra" />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {data.map((entry) => (
            <li key={entry.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-(--color-text)">
                  <Hash size={14} className="text-(--color-text-muted)" aria-hidden="true" />
                  {entry.name}
                </span>
                <span className="text-xs text-(--color-text-muted)">
                  <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(entry.total)}</span>
                  {" · "}
                  {entry.count} lançamento(s)
                </span>
              </div>
              <ProgressBar value={max > 0 ? (entry.total / max) * 100 : 0} height="sm" color="accent" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function InstallmentForecastCard({ data }: { data: InstallmentForecast[] }) {
  return (
    <CardSection
      icon={CalendarClock}
      title="Previsibilidade de parcelamentos"
      subtitle="Quando cada parcelamento ativo termina"
      empty={data.length === 0}
      emptyMessage="Você não tem parcelamentos em andamento"
    >
      <ul className="flex flex-col gap-3">
        {data.map((entry) => (
          <li key={entry.planId} className="rounded-xl border border-(--color-border) p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-(--color-text)">{entry.baseDescription}</span>
              {entry.categoryName && (
                <span className="rounded-full bg-(--color-border)/50 px-2.5 py-1 text-xs font-medium text-(--color-text-muted)">
                  {entry.categoryName}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-(--color-text-muted)">
              Termina em <span className="font-medium text-(--color-text)">{entry.endMonthLabel}</span>,{" "}
              {entry.remainingInstallments === 1 ? (
                <>
                  falta <span className="font-numeric font-medium text-(--color-text)">1 parcela</span>
                </>
              ) : (
                <>
                  faltam{" "}
                  <span className="font-numeric font-medium text-(--color-text)">{entry.remainingInstallments} parcelas</span>
                </>
              )}{" "}
              de <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(entry.estimatedAmount)}</span>
            </p>
          </li>
        ))}
      </ul>
    </CardSection>
  );
}

export function FixedExpenseAlertCard({
  data,
  candidates,
  resolved,
}: {
  data: FixedExpenseAlert | null;
  candidates: FixedExpenseCandidate[];
  resolved: FixedExpenseResolvedInsight[];
}) {
  const candidatesSection = candidates.length > 0 && (
    <div className="mt-5 border-t border-(--color-border) pt-4">
      <h4 className="text-sm font-medium text-(--color-text)">Candidatos a despesa fixa</h4>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">
        Lançamentos que se repetem mês a mês e ainda não estão marcados como fixos
      </p>
      <FixedExpenseCandidatesList candidates={candidates} />
    </div>
  );

  const resolvedSection = resolved.length > 0 && (
    <div className="mt-5 border-t border-(--color-border) pt-4">
      <h4 className="text-sm font-medium text-(--color-text)">Já resolvidos</h4>
      <FixedExpenseResolvedList resolved={resolved} />
    </div>
  );

  if (!data) {
    return (
      <Card>
        <h3 className="font-display text-base font-semibold text-(--color-text)">Despesas fixas</h3>
        <EmptySection message="Registre despesas neste mês para acompanhar o peso dos seus compromissos fixos" />
        {candidatesSection}
        {resolvedSection}
      </Card>
    );
  }

  const isAlert = data.share > 50;

  return (
    <Card
      className={clsx(
        "border",
        isAlert ? "border-(--color-danger)/30 bg-(--color-danger)/5" : "border-(--color-border)"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isAlert ? "bg-(--color-danger)/10 text-(--color-danger)" : "bg-(--color-primary)/10 text-(--color-primary)"
          )}
        >
          <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold text-(--color-text)">Despesas fixas</h3>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">
            {isAlert
              ? "Suas despesas fixas ultrapassam metade do total gasto neste mês — vale revisar contratos recorrentes."
              : "Suas despesas fixas estão sob controle em relação ao total do mês."}
          </p>
          <ProgressBar value={Math.min(100, data.share)} color={isAlert ? "danger" : "primary"} className="mt-3" />
          <p className="mt-2 text-xs text-(--color-text-muted)">
            <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(data.fixedTotal)}</span> de{" "}
            <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(data.expenseTotal)}</span> em despesas
            são fixas ({data.share.toFixed(0)}%)
          </p>
        </div>
      </div>

      {candidatesSection}
      {resolvedSection}
    </Card>
  );
}
