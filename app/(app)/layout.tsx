import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { getNavigation } from "@/components/app-nav";
import { AppShell, type ShellUser } from "@/components/app-shell";
import { getUnreadNotificationCount } from "@/lib/services/notification";

export const metadata: Metadata = {
  title: "SIM Klinik",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  let user: SessionUser;
  try {
    user = await getSessionUser();
  } catch {
    redirect("/login");
  }
  const [sections, unreadCount] = await Promise.all([Promise.resolve(getNavigation(user)), getUnreadNotificationCount(user.id)]);

  const shellUser: ShellUser = {
    fullName: user.fullName,
    username: user.username,
    roles: user.roles,
  };

  return (
    <AppShell user={shellUser} sections={sections} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}