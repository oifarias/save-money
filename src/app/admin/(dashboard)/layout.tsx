import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookieValue } from "@/lib/admin-auth";
import { adminLogoutAction } from "@/app/admin/actions";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  if (!verifyAdminSessionCookieValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg)">
      <header className="flex items-center justify-between border-b border-(--color-border) bg-(--color-surface) px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2 font-display text-base font-semibold text-(--color-text)">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-text) to-(--color-text-muted) text-white">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          Painel administrativo
        </div>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-(--color-text-muted) transition-colors hover:text-(--color-text)"
          >
            Sair
          </button>
        </form>
      </header>
      <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
