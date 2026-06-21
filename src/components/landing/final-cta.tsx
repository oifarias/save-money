import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-(--color-border) bg-gradient-to-br from-(--color-primary)/10 to-(--color-accent)/10 px-6 py-14 text-center sm:px-12">
        <h2 className="max-w-xl font-display text-2xl font-semibold text-(--color-text) sm:text-3xl">
          Seu próximo extrato pode contar uma história diferente.
        </h2>
        <Link
          href="/cadastro"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-105"
        >
          Criar minha conta
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
