import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error("[app/layout] erro ao verificar sessão:", err);
    redirect("/login");
  }

  if (!session?.user?.id) {
    console.warn("[app/layout] sessão ausente ou inválida, redirecionando para login");
    redirect("/login");
  }

  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, pendingLinkNotice: true, _count: { select: { oauthAccounts: true } } },
  });

  let showLinkNotice = false;
  if (dbUser?.pendingLinkNotice) {
    showLinkNotice = true;
    await prisma.user.update({ where: { id: userId }, data: { pendingLinkNotice: false } });
  }

  const linkedLoginMethods = [
    dbUser?.passwordHash ? "E-mail e senha" : null,
    dbUser && dbUser._count.oauthAccounts > 0 ? "Google" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <AppShell userName={session.user.name ?? "Usuário"} linkedLoginMethods={linkedLoginMethods} showLinkNotice={showLinkNotice}>
      {children}
    </AppShell>
  );
}
