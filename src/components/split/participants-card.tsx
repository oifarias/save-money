"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PublicSplit } from "@/lib/split-data";

type ParticipantItem = { id: string; description: string; date: string; amount: number };

function getParticipantItems(participantId: string, split: PublicSplit): ParticipantItem[] {
  if (split.mode === "custom") {
    return split.items.flatMap((item) => {
      const share = item.shares.find((s) => s.participantId === participantId);
      return share ? [{ id: item.id, description: item.description, date: item.date, amount: share.amount }] : [];
    });
  }

  // Modo "equal": não há seleção por lançamento — todo mundo participa de todos, em partes iguais.
  const fraction = split.participants.length > 0 ? 1 / split.participants.length : 0;
  return split.items.map((item) => ({
    id: item.id,
    description: item.description,
    date: item.date,
    amount: item.amount * fraction,
  }));
}

export function ParticipantsCard({ split }: { split: PublicSplit }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="font-display text-sm font-semibold text-(--color-text)">Quem paga quanto</h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {split.participants.map((participant) => {
          const items = getParticipantItems(participant.id, split);
          const isOpen = openId === participant.id;
          return (
            <li key={participant.id} className="overflow-hidden rounded-xl bg-(--color-bg)">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : participant.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-(--color-text)">{participant.name}</span>
                  <ChevronDown
                    className={clsx(
                      "h-3.5 w-3.5 shrink-0 text-(--color-text-muted) transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span className="shrink-0 font-numeric text-sm font-semibold text-(--color-primary)">
                  {formatCurrency(participant.amount)}
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-(--color-border) px-3.5 py-2.5">
                  {items.length === 0 ? (
                    <p className="text-xs text-(--color-text-muted)">Nenhum lançamento vinculado a essa pessoa.</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate text-(--color-text)">{item.description}</p>
                          <p className="text-(--color-text-muted)">{formatDate(item.date)}</p>
                        </div>
                        <span className="shrink-0 font-numeric font-medium text-(--color-text)">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
