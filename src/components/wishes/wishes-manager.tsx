"use client";

import { useState } from "react";
import { ChevronDown, Gift, Plus, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import type { WishSummary } from "@/lib/wish-data";
import { WishCard } from "@/components/wishes/wish-card";
import { WishFormModal, type WishFormCategory } from "@/components/wishes/wish-form-modal";
import type { AvailableGoal } from "@/components/wishes/wish-strategy-step";

type CollapsibleHistoryProps = {
  id: string;
  title: string;
  emptyHint: string;
  items: WishSummary[];
  renderBadge: (wish: WishSummary) => React.ReactNode;
};

function CollapsibleHistory({ id, title, emptyHint, items, renderBadge }: CollapsibleHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">{title}</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="font-display text-lg font-semibold text-(--color-text)">
          {title} <span className="text-sm font-normal text-(--color-text-muted)">({items.length})</span>
        </h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        id={id}
        className={`overflow-hidden transition-all duration-200 ${expanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <Card className="divide-y divide-(--color-border) p-0">
          {items.map((wish) => {
            const Icon = getCategoryIcon(wish.subcategory.icon);
            return (
              <div key={wish.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${wish.subcategory.color}1F`, color: wish.subcategory.color }}
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-text)">{wish.name}</p>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">{renderBadge(wish)}</p>
                </div>
                <span className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
                  {formatCurrency(wish.estimatedAmount)}
                </span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

type WishesManagerProps = {
  active: WishSummary[];
  purchased: WishSummary[];
  abandoned: WishSummary[];
  categories: WishFormCategory[];
  availableGoals: AvailableGoal[];
};

export function WishesManager({ active, purchased, abandoned, categories, availableGoals }: WishesManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const hasAnyWish = active.length > 0 || purchased.length > 0 || abandoned.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-text)">Desejos</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Cadastre o que você quer comprar e acompanhe quando vai poder realizar
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo desejo
        </Button>
      </div>

      {!hasAnyWish ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <Gift className="h-8 w-8 text-(--color-text-muted)" aria-hidden="true" />
          <p className="font-display text-lg font-semibold text-(--color-text)">Ainda não há desejos cadastrados</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Cadastre algo que você quer comprar — de uma besteira a um item mais caro — e a gente te ajuda a
            acompanhar o progresso até a hora de realizar.
          </p>
          <Button onClick={() => setFormOpen(true)} className="mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Cadastrar primeiro desejo
          </Button>
        </Card>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((wish) => (
                <WishCard key={wish.id} wish={wish} />
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <Gift className="h-7 w-7 text-(--color-text-muted)" aria-hidden="true" />
              <p className="text-sm text-(--color-text-muted)">Nenhum desejo ativo agora — que tal cadastrar um novo?</p>
            </Card>
          )}

          <CollapsibleHistory
            id="wishes-purchased-history"
            title="Comprados"
            emptyHint="Ainda não há desejos concluídos."
            items={purchased}
            renderBadge={(wish) => (wish.purchasedAt ? `Comprado em ${formatDate(wish.purchasedAt)}` : "Comprado")}
          />

          <CollapsibleHistory
            id="wishes-abandoned-history"
            title="Histórico de prioridades mudadas"
            emptyHint="Nenhum desejo foi deixado de lado até agora."
            items={abandoned}
            renderBadge={(wish) => (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" aria-hidden="true" />
                {wish.abandonedAt ? `Em ${formatDate(wish.abandonedAt)}` : "Prioridade mudou"}
              </span>
            )}
          />
        </>
      )}

      <WishFormModal
        open={formOpen}
        categories={categories}
        availableGoals={availableGoals}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
