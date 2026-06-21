"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markTransactionsFixedAction } from "@/app/(app)/lancamentos/actions";

export function MarkFixedButton({ ids }: { ids: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await markTransactionsFixedAction(ids);
      if (result.success) {
        toast.success(result.message ?? "Marcado como despesa fixa");
        setDone(true);
      } else {
        toast.error(result.message ?? "Não foi possível marcar como despesa fixa");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--color-success)">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Marcado como fixa
      </span>
    );
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} isLoading={isPending} className="px-3 py-1.5 text-xs">
      Marcar {ids.length} lançamento{ids.length === 1 ? "" : "s"} como fixo{ids.length === 1 ? "" : "s"}
    </Button>
  );
}
