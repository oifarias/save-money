"use client";

import { useState } from "react";
import { Bell, LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type HeaderProps = {
  userName: string;
  onMenuClick: () => void;
  linkedLoginMethods: string[];
};

export function Header({ userName, onMenuClick, linkedLoginMethods }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-(--color-border) bg-(--color-bg)/85 px-4 py-3.5 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu de navegação"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-surface) lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="font-display text-lg font-semibold text-(--color-text)">Olá, {userName.split(" ")[0]}</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors hover:text-(--color-primary)"
        >
          <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Menu do usuário"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-(--color-primary) to-(--color-primary-dark) text-xs font-semibold text-white"
          >
            {initials || "?"}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) shadow-lg animate-fade-grow"
            >
              {linkedLoginMethods.length > 0 && (
                <p className="border-b border-(--color-border) px-4 py-2.5 text-xs text-(--color-text-muted)">
                  Login ativo: {linkedLoginMethods.join(" + ")}
                </p>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-(--color-text) hover:bg-(--color-bg)"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
