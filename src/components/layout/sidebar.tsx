"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Wallet, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";

type SidebarProps = {
  variant?: "fixed" | "drawer";
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ variant = "fixed", open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <div className="flex h-full w-60 flex-col border-r border-(--color-border) bg-(--color-surface) px-4 py-6">
      <div className="mb-8 flex items-center justify-between px-2">
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-semibold text-(--color-text)">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-white">
            <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          Save Money
        </Link>
        {variant === "drawer" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-bg)"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-(--color-primary)/12 text-(--color-primary)"
                  : "text-(--color-text-muted) hover:bg-(--color-bg) hover:text-(--color-text)"
              )}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  if (variant === "fixed") {
    return <aside className="hidden lg:block lg:shrink-0">{content}</aside>;
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-40 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={clsx(
          "absolute inset-0 bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={clsx(
          "absolute inset-y-0 left-0 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </div>
    </div>
  );
}
