import Image from "next/image";
import { CalendarClock, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";

const SHOWCASES = [
  {
    icon: CalendarClock,
    title: "Previsibilidade de parcelamentos",
    description:
      "Saiba exatamente quando cada parcelamento termina, quantas parcelas faltam e quanto ainda vai sair da sua conta.",
    image: "/landing/installment-preview.png",
    alt: "Card de previsibilidade de parcelamentos mostrando que faltam 4 parcelas de R$ 350,00 para o notebook terminar em setembro",
  },
  {
    icon: ListChecks,
    title: "Check de contas fixas",
    description:
      "O sistema identifica despesas que se repetem mês a mês e te avisa quando alguma ainda não foi marcada como paga.",
    image: "/landing/fixed-expenses-preview.png",
    alt: "Card de despesas fixas mostrando um candidato recorrente de R$ 350,00 com opções para confirmar ou ignorar",
  },
];

export function PredictabilityShowcase() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
      <span className="inline-flex w-fit items-center rounded-full bg-(--color-accent)/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-(--color-accent)">
        Novidades
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold text-(--color-text) sm:text-3xl">
        Nunca mais seja pego de surpresa por uma parcela ou conta fixa
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-(--color-text-muted) sm:text-base">
        O Save Money acompanha seus parcelamentos e identifica contas recorrentes automaticamente, pra você ver o
        compromisso antes que ele vire surpresa no extrato.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SHOWCASES.map((item, index) => (
          <Card key={item.title} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-base font-semibold text-(--color-text)">{item.title}</h3>
            </div>
            <p className="text-sm text-(--color-text-muted)">{item.description}</p>
            <div className="overflow-hidden rounded-xl border border-(--color-border)">
              <Image
                src={item.image}
                alt={item.alt}
                width={495}
                height={297}
                className="w-full"
                sizes="(min-width: 1024px) 45vw, 90vw"
                priority={index === 0}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
