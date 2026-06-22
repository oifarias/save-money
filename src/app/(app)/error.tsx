"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] erro não tratado numa rota autenticada:", error);
  }, [error]);

  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-danger)/10 text-(--color-danger)">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Algo deu errado nesta tela</h2>
        <p className="mt-1 max-w-sm text-sm text-(--color-text-muted)">
          Tente novamente. Se o problema continuar, recarregue a página.
        </p>
      </div>
      <Button type="button" onClick={() => unstable_retry()}>
        Tentar novamente
      </Button>
    </Card>
  );
}
