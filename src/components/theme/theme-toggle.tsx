"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors duration-200 hover:text-(--color-primary) cursor-pointer"
    >
      <Sun
        className={`absolute h-4.5 w-4.5 transition-all duration-300 ${
          isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        }`}
        aria-hidden="true"
      />
      <Moon
        className={`absolute h-4.5 w-4.5 transition-all duration-300 ${
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
