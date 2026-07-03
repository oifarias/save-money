"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { setupNewUserDefaults } from "@/lib/onboarding";
import { loginSchema, recoverSchema, registerSchema } from "@/lib/validations/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function registerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { name, email, password } = parsed.data;

  const rateLimit = await checkLoginRateLimit(email, { limit: 5, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return { success: false, message: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return {
        success: false,
        fieldErrors: { email: "Este e-mail já está cadastrado" },
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });

      await setupNewUserDefaults(tx, user.id);
    });

  } catch (error) {
    console.error("[registerAction] erro ao criar conta:", error);
    return { success: false, message: "Erro interno ao criar conta. Tente novamente." };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    console.error("[registerAction] conta criada mas falhou o login automático:", error);
    return { success: true, message: "Conta criada! Faça login para continuar." };
  }

  return { success: true };
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    remember: formData.get("remember") === "on",
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const rateLimit = await checkLoginRateLimit(parsed.data.email, { limit: 5, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return { success: false, message: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[loginAction] falha de autenticação:", error.type, error.message);
      return { success: false, message: "E-mail ou senha incorretos" };
    }
    console.error("[loginAction] erro inesperado:", error);
    throw error;
  }

  return { success: true };
}

export async function signInWithGoogleAction(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function recoverPasswordAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = recoverSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  // Limite mais generoso que login (não é brute force de senha), mas evita
  // spam de e-mail de recuperação / varredura de enumeração via timing.
  const rateLimit = await checkLoginRateLimit(parsed.data.email, { limit: 3, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return {
      success: true,
      message: "Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.",
    };
  }

  // Em produção: gerar token temporário e enviar e-mail via Nodemailer.
  // Por segurança, sempre respondemos com sucesso (não revelamos se o e-mail existe).
  return {
    success: true,
    message: "Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.",
  };
}

function flattenZodErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
