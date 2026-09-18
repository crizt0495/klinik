"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HeartPulse,
  LayoutDashboard,
  Users,
  CalendarDays,
  ListOrdered,
  Stethoscope,
  FileText,
  Pill,
  Package,
  Truck,
  FlaskConical,
  ScanLine,
  Receipt,
  Wallet,
  Undo2,
  ShieldCheck,
  BarChart3,
  UserCog,
  Settings,
  History,
  UserRound,
  DoorOpen,
  Building2,
  CalendarClock,
  PackageSearch,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection, NavIconKey } from "@/components/app-nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const NAV_ICON_MAP: Record<NavIconKey, typeof LayoutDashboard> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "calendar-days": CalendarDays,
  "list-ordered": ListOrdered,
  stethoscope: Stethoscope,
  "file-text": FileText,
  pill: Pill,
  package: Package,
  truck: Truck,
  "flask-conical": FlaskConical,
  "scan-line": ScanLine,
  receipt: Receipt,
  wallet: Wallet,
  "undo-2": Undo2,
  "shield-check": ShieldCheck,
  "bar-chart-3": BarChart3,
  "user-cog": UserCog,
  settings: Settings,
  history: History,
  "user-round": UserRound,
  "door-open": DoorOpen,
  "building-2": Building2,
  "calendar-clock": CalendarClock,
  "package-search": PackageSearch,
  "folder-kanban": FolderKanban,
};

interface SidebarNavProps {
  sections: NavSection[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ sections, collapsed, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4", collapsed && "items-center")}>
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          {!collapsed ? <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{section.title}</p> : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = NAV_ICON_MAP[item.icon];
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const content = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-muted hover:text-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!collapsed ? <span className="flex-1 truncate">{item.title}</span> : null}
                </Link>
              );
              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.href}>{content}</div>;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex h-14 items-center gap-2.5 border-b border-border/60 px-4", collapsed && "justify-center px-2")}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-card ring-1 ring-inset ring-white/10">
          <HeartPulse className="h-[18px] w-[18px]" />
        </div>
        {!collapsed ? (
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-[-0.01em]">Klinik Sehat</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">SIM Klinik</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}