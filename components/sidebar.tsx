"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
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
    <nav className={cn("flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-thin px-3 py-3", collapsed && "items-center")}>
      {sections.map((section) => (
        <div key={section.title} className="space-y-0.5">
          {!collapsed ? <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p> : null}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = NAV_ICON_MAP[item.icon];
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const content = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-muted hover:text-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="flex-1 truncate">{item.title}</span> : null}
                  {!collapsed && active ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
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
    <div className={cn("flex h-14 items-center gap-2 border-b px-4", collapsed && "justify-center px-2")}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HeartPulse className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold">Klinik Sehat</p>
            <p className="text-[10px] text-muted-foreground">SIM Klinik</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}