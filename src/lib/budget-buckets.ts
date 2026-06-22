// Sem dependências de servidor — pode ser importado por componentes client e server.

export type Bucket = "necessidade" | "desejo";

const NECESSITY_NAMES = new Set(["Moradia", "Alimentação", "Transporte", "Saúde"]);

/** Classificação padrão sugerida (o usuário pode reclassificar livremente no passo 2 da jornada). */
export function getDefaultBucket(categoryName: string): Bucket {
  return NECESSITY_NAMES.has(categoryName) ? "necessidade" : "desejo";
}
