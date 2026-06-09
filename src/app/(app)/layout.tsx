import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error("[app/layout] erro ao verificar sessão:", err);
    redirect("/login");
  }

  if (!session?.user) {
    console.warn("[app/layout] sessão ausente ou inválida, redirecionando para login");
    redirect("/login");
  }

  return <AppShell userName={session.user.name ?? "Usuário"}>{children}</AppShell>;
}
