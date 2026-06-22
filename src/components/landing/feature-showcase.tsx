import { ArrowLeftRight, LayoutDashboard, Lightbulb, ListChecks, Target, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Resumo de entradas e saídas, evolução mês a mês e distribuição de gastos por categoria.",
  },
  {
    icon: ListChecks,
    title: "Lançamentos",
    description: "Registre, filtre por grupo, valor, descrição ou data, e edite em lote quando precisar.",
  },
  {
    icon: Target,
    title: "Metas",
    description: "Defina sua renda, divida em necessidades, desejos e poupança, e acompanhe o limite de cada categoria.",
  },
  {
    icon: Share2,
    title: "Divisão de contas",
    description: "Selecione as despesas, gere um link e divida a conta com amigos sem precisar de cadastro.",
  },
  {
    icon: ArrowLeftRight,
    title: "Comparativo",
    description: "Compare dois ou mais períodos e veja a variação percentual de cada categoria.",
  },
  {
    icon: Lightbulb,
    title: "Insights",
    description: "Ranking de categorias que mais cresceram, alertas de despesas fixas e sugestões de economia.",
  },
];

export function FeatureShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
      <h2 className="font-display text-2xl font-semibold text-(--color-text) sm:text-3xl">
        As telas que você vai usar todo dia
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="flex flex-col gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
              <feature.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="font-display text-base font-semibold text-(--color-text)">{feature.title}</h3>
            <p className="text-sm text-(--color-text-muted)">{feature.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
