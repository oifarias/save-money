"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MOBILE_NAV_ITEMS } from "@/components/layout/nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-(--color-border) bg-(--color-surface)/95 backdrop-blur px-2 py-2 lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className={clsx(
              "flex flex-1 flex-col items-center justify-center rounded-lg py-2 transition-colors duration-200",
              isActive ? "text-(--color-primary)" : "text-(--color-text-muted)"
            )}
          >
            <Icon className="h-7 w-7" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
