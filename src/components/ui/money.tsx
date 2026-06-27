"use client";

import { useValuesVisibility } from "@/contexts/values-visibility";
import { formatCurrency } from "@/lib/format";

type MoneyProps = {
  value: number;
  currency?: string;
};

export function Money({ value, currency }: MoneyProps) {
  const { showValues } = useValuesVisibility();
  return <>{showValues ? formatCurrency(value, currency) : "R$ ••••"}</>;
}
