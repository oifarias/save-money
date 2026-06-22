"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLoginAction, type AdminActionResult } from "@/app/admin/actions";

const initialState: AdminActionResult = { success: false };

export default function AdminLoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(adminLoginAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/admin");
      router.refresh();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-(--color-bg) px-4">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-(--color-text)">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-text) to-(--color-text-muted) text-white">
          <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        Painel administrativo
      </div>

      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-sm"
      >
        <Input label="Usuário" name="username" autoComplete="username" required />
        <Input label="Senha" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" isLoading={isPending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
    </div>
  );
}
