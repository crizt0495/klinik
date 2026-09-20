"use client";

import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarNav, Brand } from "@/components/sidebar";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import { BottomNav } from "@/components/bottom-nav";
import type { NavSection } from "@/components/app-nav";

export interface ShellUser {
  fullName: string;
  username: string;
  roles: string[];
}

interface AppShellProps {
  user: ShellUser;
  sections: NavSection[];
  unreadCount: number;
  children: React.ReactNode;
}

export function AppShell({ user, sections, unreadCount, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden h-full w-64 flex-col border-r border-border/60 bg-sidebar lg:flex">
        <Brand collapsed={collapsed} />
        <SidebarNav sections={sections} collapsed={collapsed} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto bg-sidebar p-0 pb-[env(safe-area-inset-bottom)]">
          <Brand />
          <SidebarNav sections={sections} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={{ fullName: user.fullName, username: user.username, roles: user.roles }}
          unreadCount={unreadCount}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
        />
        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-28 sm:px-6 sm:pt-6 sm:pb-28 lg:px-8 lg:pt-8 lg:pb-8">{children}</div>
        </main>
      </div>

      <BottomNav sections={sections} onOpenMenu={() => setMobileOpen(true)} />

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}