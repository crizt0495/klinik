"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ListOrdered, Stethoscope, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/components/app-nav";

/**
 * Android-style bottom navigation for small screens (hidden on lg+ where the
 * desktop sidebar takes over). Shows up to 4 pinned destinations plus a
 * "Menu" tab that opens the full navigation bottom-sheet.
 */

interface BottomNavProps {
  sections: NavSection[];
  onOpenMenu: () => void;
}

const PINNED: Array<{ href: string; title: string; icon: LucideIcon; exact?: boolean }> = [
  { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/patients", title: "Pasien", icon: Users },
  { href: "/queue", title: "Antrian", icon: ListOrdered },
  { href: "/visits", title: "Kunjungan", icon: Stethoscope },
];

export function BottomNav({ sections, onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();

  // Hanya tampilkan tab yang diizinkan untuk peran user (sections sudah difilter perizinan).
  const available = new Set(sections.flatMap((section) => section.items.map((item) => item.href)));
  const tabs = PINNED.filter((tab) => available.has(tab.href));

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const activeHref = tabs.find((tab) => isActive(tab.href, tab.exact))?.href ?? null;
  const menuActive = activeHref === null;

  const tabClass = (active: boolean) =>
    cn(
      "relative flex select-none flex-col items-center gap-1 px-1 pt-2.5 pb-1.5 text-[10px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  const iconClass = (active: boolean) => cn("h-[22px] w-[22px] transition-transform", active && "-translate-y-px scale-110");

  const labelClass = (active: boolean) => cn("rounded-full px-1.5 py-px leading-[1.1]", active && "bg-primary/10");

  const indicator = (active: boolean) => (active ? <span className="absolute -top-px h-0.5 w-8 rounded-full bg-primary" aria-hidden /> : null);

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 grid grid-flow-col auto-cols-fr border-t border-border/70 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigasi utama"
    >
      {tabs.map((tab) => {
        const active = activeHref === tab.href;
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} className={tabClass(active)}>
            {indicator(active)}
            <Icon className={iconClass(active)} strokeWidth={active ? 2.4 : 2} />
            <span className={labelClass(active)}>{tab.title}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onOpenMenu} className={tabClass(menuActive)} aria-label="Buka daftar menu lengkap">
        {indicator(menuActive)}
        <LayoutGrid className={iconClass(menuActive)} strokeWidth={menuActive ? 2.4 : 2} />
        <span className={labelClass(menuActive)}>Menu</span>
      </button>
    </nav>
  );
}