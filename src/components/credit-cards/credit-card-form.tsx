"use client";

import { useActionState, useEffect } from "react";
import { BankPicker } from "@/components/credit-cards/bank-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCreditCardAction,
  updateCreditCardAction,
  type ActionResult,
} from "@/app/(app)/lancamentos/cartoes/actions";
import type { BankCode } from "@/lib/bank-icons";

type CreditCardData = {
  id: string;
  bankCode: string;
  nickname: string | null;
  limit: number;
  dueDay: number;
};

type CreditCardFormProps = {
  initialData?: CreditCardData;
  onSuccess: () => void;
  onCancel: () => void;
};

const INITIAL_STATE: ActionResult = { success: false };

export function CreditCardForm({ initialData, onSuccess, onCancel }: CreditCardFormProps) {
  const action = initialData ? updateCreditCardAction : createCreditCardAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.success && state.message) {
      onSuccess();
    }
    // onSuccess intencionalmente omitido das deps: a referência muda a cada render do pai
    // e incluí-la causaria re-execuções espúrias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.message]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {initialData && <input type="hidden" name="id" value={initialData.id} />}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-(--color-text)">Banco</label>
        <BankPicker
          defaultValue={(initialData?.bankCode as BankCode | undefined) ?? ""}
          error={state.fieldErrors?.bankCode}
        />
      </div>

      <Input
        label="Apelido (opcional)"
        name="nickname"
        placeholder="Ex: pessoal, viagens, trabalho..."
        defaultValue={initialData?.nickname ?? ""}
        error={state.fieldErrors?.nickname}
      />

      <Input
        label="Limite do cartão (R$)"
        name="limit"
        type="number"
        step="0.01"
        min={0.01}
        inputMode="decimal"
        placeholder="0.00"
        defaultValue={initialData?.limit ?? ""}
        error={state.fieldErrors?.limit}
        className="font-numeric"
      />

      <Input
        label="Dia de vencimento"
        name="dueDay"
        type="number"
        placeholder="Ex: 10"
        min={1}
        max={28}
        defaultValue={initialData?.dueDay?.toString() ?? ""}
        error={state.fieldErrors?.dueDay}
      />

      {state.message && !state.success && (
        <p className="text-sm text-(--color-danger)">{state.message}</p>
      )}

      <div className="flex justify-end gap-3 border-t border-(--color-border) pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending}>
          {initialData ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
