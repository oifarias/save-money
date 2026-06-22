import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ShareExplainerCard() {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
        <HandCoins className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-display text-sm font-semibold text-(--color-text)">Divida uma conta com alguém</h2>
        <p className="mt-0.5 text-sm text-(--color-text-muted)">
          Marque lançamentos na lista abaixo e gere um link pra dividir o valor com quem participou — sem precisar
          criar conta.
        </p>
      </div>
    </Card>
  );
}
