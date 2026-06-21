import { Layers, Sheet, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";

const VALUE_PROPS = [
  {
    icon: Layers,
    title: "Grupos e sub-grupos",
    description: "Organize gastos em categorias e subcategorias do seu jeito, não do jeito que o sistema impõe.",
  },
  {
    icon: Sheet,
    title: "Importe sua planilha em minutos",
    description: "Suba o extrato em Excel e o sistema mapeia as colunas pra você. Sem digitar lançamento por lançamento.",
  },
  {
    icon: Lightbulb,
    title: "Insights que apontam o que cortar",
    description: "Alertas de despesas fixas e ranking das categorias que mais cresceram, mês a mês.",
  },
];

export function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
      <h2 className="font-display text-2xl font-semibold text-(--color-text) sm:text-3xl">
        Feito pra quem leva o orçamento a sério
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VALUE_PROPS.map((prop) => (
          <Card key={prop.title} className="flex flex-col gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
              <prop.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="font-display text-lg font-semibold text-(--color-text)">{prop.title}</h3>
            <p className="text-sm text-(--color-text-muted)">{prop.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
