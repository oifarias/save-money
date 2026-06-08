"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";

export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar variant="fixed" />
      <Sidebar variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header userName={userName} onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
