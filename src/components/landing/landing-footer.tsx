import Link from "next/link";
import { Wallet } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-(--color-border)">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-sm font-semibold text-(--color-text)">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Save Money
        </Link>
        <p className="text-xs text-(--color-text-muted)">© {new Date().getFullYear()} Save Money</p>
        <Link href="/login" className="text-sm font-medium text-(--color-primary) hover:underline">
          Entrar
        </Link>
      </div>
    </footer>
  );
}
