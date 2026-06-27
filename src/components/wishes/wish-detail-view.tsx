"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Info, PiggyBank, Sparkles, Target, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { IconBadge } from "@/components/ui/icon-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import type { WishSummary } from "@/lib/wish-data";
import { WishPurchaseModal } from "@/components/wishes/wish-purchase-modal";
import { WishAbandonDialog } from "@/components/wishes/wish-abandon-dialog";
import { WishStrategyStep, type AvailableGoal } from "@/components/wishes/wish-strategy-step";
import { WishMilestoneToast } from "@/components/wishes/wish-milestone-toast";
import { addWishContributionAction } from "@/app/(app)/desejos/actions";

function cashTimelineMessage(wish: WishSummary): string | null {
  const readiness = wish.readiness;
  if (!readiness) return null;
  if (readiness.cashTimeline === "now") {
    return "Pode comprar à vista este mês — o orçamento da categoria comporta esse valor agora.";
  }
  if (readiness.cashTimeline === "future" && readiness.cashAvailableMonthKey) {
    const label = monthLabel(new Date(`${readiness.cashAvailableMonthKey}-01`));
    return readiness.freedByInstallmentEnding
      ? `Pode comprar à vista a partir de ${label}, quando uma parcela em andamento dessa categoria termina e libera espaço no orçamento.`
      : `Pode comprar à vista a partir de ${label}, quando o orçamento da categoria comportar esse valor.`;
  }
  if (readiness.cashTimeline === "beyond_horizon") {
    return "No ritmo atual de parcelas, não há previsão de espaço no orçamento da categoria nos próximos 12 meses.";
  }
  return null;
}

type WishDetailViewProps = {
  wish: WishSummary;
  availableGoals: AvailableGoal[];
};

export function WishDetailView({ wish, availableGoals }: WishDetailViewProps) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [contribution, setContribution] = useState("");
  const [isPending, startTransition] = useTransition();

  const progressPercent = wish.goal?.progressPercent ?? 0;
  const timelineMessage = cashTimelineMessage(wish);
  const remaining = wish.goal ? Math.max(0, wish.estimatedAmount - wish.goal.currentAmount) : wish.estimatedAmount;
  const accumulated = wish.goal?.currentAmount ?? 0;
  const gapFocus = progressPercent < 60;

  function handleContribute(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(contribution.replace(",", ".")) || 0;
    if (amount <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    startTransition(async () => {
      const result = await addWishContributionAction({ wishId: wish.id, amount });
      if (result.success) {
        toast.success(result.message ?? "Aporte registrado");
        setContribution("");
      } else {
        toast.error(result.message ?? "Não foi possível registrar o aporte");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {wish.goal && <WishMilestoneToast wishId={wish.id} wishName={wish.name} progressPercent={progressPercent} />}
      <Link
        href="/desejos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-text-muted) hover:text-(--color-text)"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para desejos
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconBadge icon={getCategoryIcon(wish.subcategory.icon)} colorHex={wish.subcategory.color} size="lg" />
            <div>
              <h1 className="font-display text-xl font-semibold text-(--color-text)">{wish.name}</h1>
              <p className="mt-0.5 text-sm text-(--color-text-muted)">
                {wish.category.name} · {wish.subcategory.name}
              </p>
            </div>
          </div>
          <p className="shrink-0 font-numeric text-lg font-semibold text-(--color-text)">
            {formatCurrency(wish.estimatedAmount)}
          </p>
        </div>

        {wish.notes && <p className="text-sm text-(--color-text-muted)">{wish.notes}</p>}

        {wish.status === "PURCHASED" && (
          <StatusBadge
            label={`Comprado${wish.purchasedAt ? ` em ${formatDate(wish.purchasedAt)}` : ""}`}
            variant="success"
            icon={CheckCircle2}
            size="sm"
          />
        )}

        {wish.status === "ABANDONED" && (
          <StatusBadge
            label={`Prioridade mudou${wish.abandonedAt ? ` em ${formatDate(wish.abandonedAt)}` : ""}`}
            variant="muted"
            icon={XCircle}
            size="sm"
          />
        )}
        {wish.status === "ABANDONED" && wish.abandonReason && (
          <p className="text-sm text-(--color-text-muted)">Motivo registrado: {wish.abandonReason}</p>
        )}

        {wish.status === "ACTIVE" && (
          <>
            {wish.goal ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={gapFocus ? "font-semibold text-(--color-text)" : "text-(--color-text-muted)"}>
                    {gapFocus ? `Faltam ${formatCurrency(remaining)}` : `Você já tem ${formatCurrency(accumulated)}`}
                  </span>
                  <span className="text-(--color-text-muted)">{Math.round(progressPercent)}%</span>
                </div>
                <ProgressBar value={progressPercent} showMilestones height="lg" />
                <p className="text-xs text-(--color-text-muted)">
                  {gapFocus ? `Você já tem ${formatCurrency(accumulated)}` : `Faltam ${formatCurrency(remaining)}`} · meta
                  &ldquo;{wish.goal.name}&rdquo;
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-(--color-border) px-4 py-3.5">
                <p className="text-sm text-(--color-text-muted)">
                  Este desejo ainda não tem um plano de economia. Vincular uma meta ajuda a acompanhar o progresso.
                </p>
                <Button type="button" variant="secondary" onClick={() => setStrategyOpen(true)}>
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Definir estratégia de economia
                </Button>
              </div>
            )}

            {timelineMessage && (
              <Alert variant={wish.readiness?.cashTimeline === "now" ? "success" : "info"} icon={Sparkles}>
                <p>{timelineMessage}</p>
              </Alert>
            )}

            {wish.readiness?.cashTimeline === "indeterminate" && (
              <Alert variant="neutral" icon={Info}>
                <p>
                  Orçamento do grupo &ldquo;{wish.category.name}&rdquo; ainda não configurado — configure em Metas para sabermos
                  quando o orçamento dessa categoria comporta a compra à vista.
                </p>
              </Alert>
            )}

            {wish.readiness && !wish.readiness.savings.alreadyEnough && (
              <Alert variant="default" icon={PiggyBank}>
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium">Quer guardar em vez de esperar?</p>
                  <p className="text-(--color-text-muted)">
                    Faltam {formatCurrency(wish.readiness.savings.remainingAmount)} para comprar à vista.
                    {wish.readiness.savings.monthlyNeededForDeadline !== null &&
                      ` Para chegar lá até o prazo da meta, guarde ${formatCurrency(
                        wish.readiness.savings.monthlyNeededForDeadline
                      )}/mês.`}
                    {wish.readiness.savings.monthlyNeededForDeadline === null &&
                      wish.readiness.savings.suggestedMonthly !== null &&
                      wish.readiness.savings.monthsAtSuggestedRate !== null &&
                      (wish.readiness.savings.suggestedMonthly > 0
                        ? ` Na sua sobra mensal estimada de orçamento (${formatCurrency(
                            wish.readiness.savings.suggestedMonthly
                          )}/mês), você completa em ${wish.readiness.savings.monthsAtSuggestedRate} ${
                            wish.readiness.savings.monthsAtSuggestedRate === 1 ? "mês" : "meses"
                          }.`
                        : " Seu orçamento atual não deixa sobra mensal estimada — ajuste os limites em Metas ou guarde um valor manualmente.")}
                    {wish.readiness.savings.suggestedMonthly === null &&
                      " Configure o orçamento em Metas para estimarmos quanto você pode guardar por mês."}
                  </p>
                </div>
              </Alert>
            )}

            {wish.goal && (
              <form onSubmit={handleContribute} className="flex flex-col gap-2 border-t border-(--color-border) pt-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Aportar agora (R$)"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={contribution}
                    onChange={(event) => setContribution(event.target.value)}
                    className="font-numeric"
                  />
                </div>
                <Button type="submit" variant="secondary" isLoading={isPending}>
                  Continuar acumulando
                </Button>
              </form>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-(--color-border) pt-4">
              <Button type="button" variant="ghost" onClick={() => setAbandonOpen(true)}>
                Mudar de prioridade
              </Button>
              <Button type="button" onClick={() => setPurchaseOpen(true)}>
                Marcar como comprado
              </Button>
            </div>
          </>
        )}
      </Card>

      <WishPurchaseModal
        open={purchaseOpen}
        wishId={wish.id}
        wishName={wish.name}
        estimatedAmount={wish.estimatedAmount}
        onClose={() => setPurchaseOpen(false)}
      />

      <WishAbandonDialog
        open={abandonOpen}
        wishId={wish.id}
        wishName={wish.name}
        onDone={() => setAbandonOpen(false)}
        onCancel={() => setAbandonOpen(false)}
      />

      <Modal open={strategyOpen} title="Plano de economia" onClose={() => setStrategyOpen(false)}>
        <WishStrategyStep
          wishId={wish.id}
          wishName={wish.name}
          estimatedAmount={wish.estimatedAmount}
          availableGoals={availableGoals}
          onBack={() => setStrategyOpen(false)}
          onDone={() => setStrategyOpen(false)}
        />
      </Modal>
    </div>
  );
}
