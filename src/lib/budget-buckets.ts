// Sem dependências de servidor — pode ser importado por componentes client e server.

import { Heart, ShieldCheck } from "lucide-react";

export type Bucket = "necessidade" | "desejo";

const NECESSITY_NAMES = new Set(["Moradia", "Alimentação", "Transporte", "Saúde"]);

/** Classificação padrão sugerida (o usuário pode reclassificar livremente no passo 2 da jornada). */
export function getDefaultBucket(categoryName: string): Bucket {
  return NECESSITY_NAMES.has(categoryName) ? "necessidade" : "desejo";
}

/**
 * Ícone/cor padrão para necessidade x desejo, usado tanto no `Budget.bucket` (granularidade de
 * categoria, no módulo de Metas) quanto no `Wish.kind` (granularidade de item, no módulo de Lista
 * de compras) — mesma identidade visual, conceitos diferentes.
 */
export const BUCKET_OPTIONS = [
  { value: "necessidade" as const, label: "Necessidade", icon: ShieldCheck, color: "var(--color-primary)" },
  { value: "desejo" as const, label: "Desejo", icon: Heart, color: "var(--color-danger)" },
];
