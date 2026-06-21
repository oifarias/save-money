import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-(--color-border) bg-(--color-bg)/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-(--color-text)">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white">
            <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          Save Money
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:border-(--color-primary) sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-105"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>
    </header>
  );
}
