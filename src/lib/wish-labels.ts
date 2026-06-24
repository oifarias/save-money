// Sem dependências de servidor — pode ser importado por componentes client e server.

import { Heart, ShieldCheck } from "lucide-react";
import type { WishKind, WishPaymentMethod, WishPurchaseTiming } from "@/generated/prisma/client";

export const WISH_KIND_LABELS: Record<WishKind, string> = {
  NEED: "Necessidade",
  WANT: "Desejo",
};

/** Mesma identidade visual do `Budget.bucket` (ícone + cor) — granularidade diferente, mesmo significado. */
export const WISH_KIND_OPTIONS = [
  { value: "NEED" as const, label: WISH_KIND_LABELS.NEED, icon: ShieldCheck, color: "var(--color-primary)" },
  { value: "WANT" as const, label: WISH_KIND_LABELS.WANT, icon: Heart, color: "var(--color-danger)" },
];

export const PURCHASE_TIMING_LABELS: Record<WishPurchaseTiming, string> = {
  THIS_MONTH: "Este mês",
  NEXT_MONTH: "Mês que vem",
  LATER: "Mais pra frente",
};

export const PAYMENT_METHOD_LABELS: Record<WishPaymentMethod, string> = {
  CASH: "À vista",
  INSTALLMENTS: "Parcelado",
};
