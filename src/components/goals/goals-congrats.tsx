"use client";

import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GoalsCongrats() {
  const router = useRouter();

  return (
    <Card className="flex flex-col items-center gap-4 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-success)/10 text-(--color-success)">
        <PartyPopper className="h-8 w-8" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-(--color-text)">Parabéns, suas metas estão definidas!</h2>
        <p className="mt-2 max-w-sm text-sm text-(--color-text-muted)">
          Dar esse primeiro passo já coloca você na frente de quem nunca planeja o próprio dinheiro. Agora é
          acompanhar o quanto já gastou de cada grupo e ajustar conforme o mês andar.
        </p>
      </div>
      <Button type="button" onClick={() => router.push("/metas")}>
        Ver minhas metas
      </Button>
    </Card>
  );
}
