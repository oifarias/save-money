"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { ValuesVisibilityProvider } from "@/contexts/values-visibility";

type AppShellProps = {
  userName: string;
  children: React.ReactNode;
  linkedLoginMethods: string[];
  showLinkNotice: boolean;
};

export function AppShell({ userName, children, linkedLoginMethods, showLinkNotice }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (showLinkNotice) {
      toast.success("Sua conta Google foi vinculada à sua conta existente. Agora você pode entrar com e-mail/senha ou Google.");
    }
  }, [showLinkNotice]);

  return (
    <ValuesVisibilityProvider>
      <div className="flex min-h-screen">
        <Sidebar variant="fixed" />
        <Sidebar variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <Header userName={userName} onMenuClick={() => setDrawerOpen(true)} linkedLoginMethods={linkedLoginMethods} />
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</main>
        </div>

        <BottomNav />
      </div>
    </ValuesVisibilityProvider>
  );
}
