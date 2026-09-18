"use client";

import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarNav, Brand } from "@/components/sidebar";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
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
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
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
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}