"use client";

import { useState } from "react";
import { BankIcon, BANKS, type BankCode } from "@/lib/bank-icons";

type BankPickerProps = {
  defaultValue?: BankCode | "";
  error?: string;
};

export function BankPicker({ defaultValue = "", error }: BankPickerProps) {
  const [selected, setSelected] = useState<BankCode | "">(defaultValue);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="bankCode" value={selected} />
      <div className="grid grid-cols-4 gap-2">
        {BANKS.map((bank) => {
          const isSelected = selected === bank.code;
          return (
            <button
              key={bank.code}
              type="button"
              onClick={() => setSelected(bank.code)}
              className={[
                "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                isSelected
                  ? "border-2 bg-(--color-surface)"
                  : "border-(--color-border) bg-(--color-bg) hover:border-(--color-primary)/40",
              ].join(" ")}
              style={isSelected ? { borderColor: bank.color } : undefined}
              aria-pressed={isSelected}
              aria-label={bank.name}
            >
              <BankIcon bankCode={bank.code} size="md" />
              <span className="text-center text-[10px] leading-tight text-(--color-text-muted)">
                {bank.name}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
