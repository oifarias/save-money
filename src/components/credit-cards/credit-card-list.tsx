import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { BankIcon, getBankByCode } from "@/lib/bank-icons";

type CreditCardItem = {
  id: string;
  bankCode: string;
  nickname: string | null;
  limit: number;
  dueDay: number;
  createdAt: Date;
  updatedAt: Date;
};

type CreditCardListProps = {
  cards: CreditCardItem[];
  onEdit: (card: CreditCardItem) => void;
  onDelete: (id: string) => void;
};

export function CreditCardList({ cards, onEdit, onDelete }: CreditCardListProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title="Nenhum cartão cadastrado"
        description="Cadastre seus cartões de crédito para acompanhar limites e vencimentos."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const bank = getBankByCode(card.bankCode);
        const displayName = card.nickname ?? bank?.name ?? card.bankCode;
        const subtitle = card.nickname ? bank?.name : undefined;

        return (
          <Card key={card.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <BankIcon bankCode={card.bankCode} size="md" />
                <div>
                  <p className="font-medium text-(--color-text)">{displayName}</p>
                  {subtitle && (
                    <p className="text-xs text-(--color-text-muted)">{subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconActionButton
                  icon={Pencil}
                  label={`Editar cartão ${displayName}`}
                  hoverVariant="primary"
                  onClick={() => onEdit(card)}
                />
                <IconActionButton
                  icon={Trash2}
                  label={`Excluir cartão ${displayName}`}
                  hoverVariant="danger"
                  onClick={() => onDelete(card.id)}
                />
              </div>
            </div>

            <div className="border-t border-(--color-border)" />

            <div className="flex items-center justify-between">
              <span className="text-xs text-(--color-text-muted)">
                Limite:{" "}
                <span className="font-medium text-(--color-text)">
                  {card.limit.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </span>
              <span className="rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-0.5 text-[10px] font-medium text-(--color-text-muted)">
                Vence dia {card.dueDay}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
