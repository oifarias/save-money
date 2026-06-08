import Link from "next/link";
import { Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg)">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-(--color-text)">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white">
            <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          Save Money
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-fade-grow">{children}</div>
      </main>
    </div>
  );
}
