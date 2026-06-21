import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LiveLedger } from "@/components/landing/live-ledger";

export function LandingHero() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <span className="inline-flex w-fit items-center rounded-full bg-(--color-primary)/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-(--color-primary)">
          Controle financeiro pessoal
        </span>

        <h1 className="font-display text-4xl font-semibold leading-[1.1] text-(--color-text) sm:text-5xl">
          Pare de adivinhar pra onde seu dinheiro foi.
        </h1>

        <p className="max-w-md text-base text-(--color-text-muted) sm:text-lg">
          Lance, categorize e acompanhe cada entrada e saída — com gráficos que respondem a pergunta que importa:
          sobrou ou faltou?
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:brightness-105"
          >
            Criar conta grátis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl border border-(--color-border) bg-(--color-surface) px-5 py-3 text-sm font-medium text-(--color-text) transition-colors hover:border-(--color-primary)"
          >
            Entrar
          </Link>
        </div>

        <p className="text-xs text-(--color-text-muted)">Grátis. Sem cartão de crédito.</p>
      </div>

      <LiveLedger />
    </section>
  );
}
