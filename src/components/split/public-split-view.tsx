import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PublicSplit } from "@/lib/split-data";

export function PublicSplitView({ split }: { split: PublicSplit }) {
  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg)">
      <header className="flex items-center justify-center px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold text-(--color-text)">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white">
            <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          Save Money
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-12">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Conta dividida</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-(--color-text)">{split.title}</h1>
          <p className="mt-2 font-numeric text-3xl font-semibold text-(--color-text)">{formatCurrency(split.total)}</p>
        </div>

        <Card>
          <h2 className="font-display text-sm font-semibold text-(--color-text)">Quem paga quanto</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {split.participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-(--color-bg) px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-(--color-text)">{participant.name}</span>
                <span className="font-numeric text-sm font-semibold text-(--color-primary)">
                  {formatCurrency(participant.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-display text-sm font-semibold text-(--color-text)">Lançamentos incluídos</h2>
          <ul className="mt-3 flex flex-col divide-y divide-(--color-border)">
            {split.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-(--color-text)">{item.description}</p>
                  <p className="text-xs text-(--color-text-muted)">{formatDate(item.date)}</p>
                </div>
                <span className="shrink-0 font-numeric font-medium text-(--color-text)">
                  {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-center text-xs text-(--color-text-muted)">
          Gerado com{" "}
          <Link href="/" className="font-medium text-(--color-primary) hover:underline">
            Save Money
          </Link>
        </p>
      </main>
    </div>
  );
}

export function PublicSplitNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-(--color-bg) px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-danger)/10 text-(--color-danger)">
        <Wallet className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h1 className="font-display text-lg font-semibold text-(--color-text)">Esse link não está mais disponível</h1>
        <p className="mt-1 max-w-sm text-sm text-(--color-text-muted)">
          O link pode ter sido removido por quem criou, ou o endereço está incompleto.
        </p>
      </div>
      <Link href="/" className="text-sm font-medium text-(--color-primary) hover:underline">
        Ir para o Save Money
      </Link>
    </div>
  );
}
