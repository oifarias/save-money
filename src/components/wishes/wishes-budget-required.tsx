import Link from "next/link";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WishesBudgetRequired() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Lista de compras</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Cadastre os itens que você deseja comprar para se organizar financeiramente da melhor forma.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <Target className="h-8 w-8 text-(--color-primary)" aria-hidden="true" />
        <p className="font-display text-lg font-semibold text-(--color-text)">Defina suas metas de gastos primeiro</p>
        <p className="max-w-md text-sm text-(--color-text-muted)">
          Antes de cadastrar itens na lista de compras, defina quanto pretende gastar por grupo este mês. Assim a
          gente consegue te dizer quando cada item cabe no seu orçamento.
        </p>
        <Link href="/metas">
          <Button type="button" className="mt-2">
            Definir metas de gastos
          </Button>
        </Link>
      </Card>
    </div>
  );
}
