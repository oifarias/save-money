"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction, type ActionResult } from "@/app/(auth)/actions";

const initialState: ActionResult = { success: false };

export default function CadastroPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
      router.push("/login");
    } else if (state.success) {
      toast.success("Conta criada com sucesso!");
      router.push("/dashboard");
      router.refresh();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Crie sua conta</h1>
        <p className="text-sm text-(--color-text-muted)">Comece a organizar suas finanças em poucos minutos</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-sm">
        <Input
          label="Nome completo"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Como podemos te chamar?"
          error={state.fieldErrors?.name}
          required
        />
        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          error={state.fieldErrors?.email}
          required
        />
        <Input
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mín. 8 caracteres, 1 maiúscula e 1 número"
          error={state.fieldErrors?.password}
          required
        />

        <Button type="submit" isLoading={isPending} className="mt-1 w-full">
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-(--color-text-muted)">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-(--color-primary) hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
