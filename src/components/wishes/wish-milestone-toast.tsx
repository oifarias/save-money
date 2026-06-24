"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

const MILESTONES = [25, 50, 75] as const;

function storageKey(wishId: string) {
  return `wish-milestone-seen:${wishId}`;
}

function highestMilestoneReached(progressPercent: number): number {
  let highest = 0;
  for (const milestone of MILESTONES) {
    if (progressPercent >= milestone) highest = milestone;
  }
  return highest;
}

/**
 * Dispara um toast leve (reforço positivo, não modal interruptivo) quando o progresso de economia
 * de um desejo cruza 25/50/75%. A comparação acontece inteiramente no client a partir do
 * `progressPercent` já calculado pelo server — sem nova tabela de "marcos atingidos". O último
 * marco já celebrado é guardado em `sessionStorage` por `wishId` para não repetir o toast a cada
 * render/navegação dentro da mesma sessão.
 */
export function WishMilestoneToast({
  wishId,
  wishName,
  progressPercent,
}: {
  wishId: string;
  wishName: string;
  progressPercent: number;
}) {
  useEffect(() => {
    const reached = highestMilestoneReached(progressPercent);
    if (reached === 0) return;

    const key = storageKey(wishId);
    const lastSeen = Number(sessionStorage.getItem(key) ?? "0");
    if (reached <= lastSeen) return;

    sessionStorage.setItem(key, String(reached));
    toast.success(`${wishName}: você já chegou a ${reached}% do seu desejo!`, { icon: "🎉" });
  }, [wishId, wishName, progressPercent]);

  return null;
}
