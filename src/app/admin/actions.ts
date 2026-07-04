"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE, createAdminSessionCookieValue, verifyAdminCredentials } from "@/lib/admin-auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";

export type AdminActionResult = {
  success: boolean;
  message?: string;
};

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});

export async function adminLoginAction(
  _prev: AdminActionResult,
  formData: FormData
): Promise<AdminActionResult> {
  const parsed = loginSchema.safeParse({
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { success: false, message: "Informe usuário e senha" };
  }

  const rateLimit = await checkLoginRateLimit(parsed.data.username, { limit: 5, windowMs: 60_000 });
  if (!rateLimit.allowed) {
    return { success: false, message: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." };
  }

  const isValid = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!isValid) {
    return { success: false, message: "Usuário ou senha inválidos" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return { success: true };
}

export async function adminLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
