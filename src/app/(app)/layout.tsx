import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    console.warn("[app/layout] sessão ausente ou inválida, redirecionando para login");
    redirect("/login");
  }

  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, pendingLinkNotice: true, tokenVersion: true, _count: { select: { oauthAccounts: true } } },
  });

  // Sessão JWT emitida antes do logout mais recente (tokenVersion desatualizada) — derruba aqui,
  // já que a estratégia "jwt" não consegue revogar o token no momento do logout em si.
  // (signOut() só pode mexer em cookies dentro de Route Handler/Server Action, daí o redirect.)
  if (!dbUser || dbUser.tokenVersion !== (session.user.tokenVersion ?? 0)) {
    redirect("/api/auth/force-signout");
  }

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
