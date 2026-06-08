"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type ActionResult } from "@/app/(auth)/actions";

const initialState: ActionResult = { success: false };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success("Login realizado com sucesso!");
      router.push(searchParams.get("callbackUrl") ?? "/dashboard");
      router.refresh();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router, searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
        <p className="text-sm text-(--color-text-muted)">Acesse sua conta para continuar no controle dos seus gastos</p>
      </div>

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
        <Input
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={state.fieldErrors?.password}
          required
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-(--color-text-muted)">
            <input type="checkbox" name="remember" className="h-4 w-4 rounded border-(--color-border) accent-(--color-primary)" />
            Lembrar acesso
          </label>
          <Link href="/recuperar-senha" className="font-medium text-(--color-primary) hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        <Button type="submit" isLoading={isPending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-(--color-text-muted)">
        Ainda não tem uma conta?{" "}
        <Link href="/cadastro" className="font-medium text-(--color-primary) hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
