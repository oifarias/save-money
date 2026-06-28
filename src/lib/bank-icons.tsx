import React from "react";

export type BankCode = "btg" | "itau" | "bradesco" | "santander" | "nubank" | "neon" | "inter" | "c6";

export const BANKS = [
  { code: "btg"       as BankCode, name: "BTG Pactual", color: "#004B8D", textColor: "#ffffff", initials: "BTG"   },
  { code: "itau"      as BankCode, name: "Itaú",        color: "#EC7000", textColor: "#ffffff", initials: "ITAÚ"  },
  { code: "bradesco"  as BankCode, name: "Bradesco",    color: "#CC092F", textColor: "#ffffff", initials: "BRAD"  },
  { code: "santander" as BankCode, name: "Santander",   color: "#EC0000", textColor: "#ffffff", initials: "SAN"   },
  { code: "nubank"    as BankCode, name: "Nubank",      color: "#820AD1", textColor: "#ffffff", initials: "NU"    },
  { code: "neon"      as BankCode, name: "Neon",        color: "#1BD3B0", textColor: "#0a0a0a", initials: "NEON"  },
  { code: "inter"     as BankCode, name: "Inter",       color: "#FF7A00", textColor: "#ffffff", initials: "INTER" },
  { code: "c6"        as BankCode, name: "C6 Bank",     color: "#242424", textColor: "#ffffff", initials: "C6"    },
] as const;

export function getBankByCode(code: string) {
  return BANKS.find((b) => b.code === code);
}

type BankIconSize = "sm" | "md" | "lg";

const sizeClasses: Record<BankIconSize, { container: string; text: string }> = {
  sm: { container: "h-8 w-8 rounded-lg",   text: "text-[9px] font-bold"  },
  md: { container: "h-10 w-10 rounded-xl",  text: "text-[10px] font-bold" },
  lg: { container: "h-14 w-14 rounded-2xl", text: "text-xs font-bold"     },
};

type BankIconProps = {
  bankCode: string;
  size?: BankIconSize;
  className?: string;
};

export function BankIcon({ bankCode, size = "md", className = "" }: BankIconProps) {
  const bank = getBankByCode(bankCode);
  const { container, text } = sizeClasses[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${container} ${className}`}
      style={{ backgroundColor: bank?.color ?? "#6b7280" }}
      aria-label={bank?.name ?? bankCode}
      role="img"
    >
      <span
        className={`select-none tracking-tight leading-none ${text}`}
        style={{ color: bank?.textColor ?? "#ffffff" }}
      >
        {bank?.initials ?? bankCode.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}
