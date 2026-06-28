export type ColorSection = {
  label: string;
  colors: string[];
};

export const COLOR_SECTIONS: ColorSection[] = [
  {
    label: "Verde",
    colors: ["#15803D", "#16A34A", "#22C55E", "#4ADE80", "#1A9E6F", "#14B8A6", "#0D9488"],
  },
  {
    label: "Azul",
    colors: ["#1E3A8A", "#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#0284C7", "#0EA5E9"],
  },
  {
    label: "Roxo & Rosa",
    colors: ["#4C1D95", "#6D28D9", "#7C3AED", "#9333EA", "#A855F7", "#DB2777", "#EC4899"],
  },
  {
    label: "Vermelho & Laranja",
    colors: ["#991B1B", "#DC2626", "#E11D48", "#EA580C", "#F97316", "#D97706", "#F59E0B"],
  },
  {
    label: "Neutro",
    colors: ["#111827", "#1F2937", "#374151", "#4B5563", "#6B7280", "#9CA3AF", "#8A9E94"],
  },
];

export const CATEGORY_COLORS = COLOR_SECTIONS.flatMap((s) => s.colors);
