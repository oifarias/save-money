"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recoverPasswordAction, type ActionResult } from "@/app/(auth)/actions";

const initialState: ActionResult = { success: false };

export default function RecuperarSenhaPage() {
  const [state, formAction, isPending] = useActionState(recoverPasswordAction, initialState);

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="text-sm text-(--color-text-muted)">
          Informe seu e-mail e enviaremos um link temporário para redefinir sua senha
        </p>
      </div>

      {state.success ? (
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 text-center text-sm text-(--color-text)">
          {state.message}
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-sm">
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@email.com"
            error={state.fieldErrors?.email}
            required
          />
          <Button type="submit" isLoading={isPending} className="mt-1 w-full">
            Enviar link de recuperação
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-(--color-text-muted)">
        Lembrou sua senha?{" "}
        <Link href="/login" className="font-medium text-(--color-primary) hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
