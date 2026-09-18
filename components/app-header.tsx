"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/features/auth/actions";
import { initials } from "@/lib/utils";

interface AppHeaderProps {
  user: { fullName: string; username: string; roles: string[] };
  unreadCount: number;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
  onOpenCommand: () => void;
}

export function AppHeader({ user, unreadCount, collapsed, onToggleSidebar, onOpenMenu, onOpenCommand }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);

  const title = pathname === "/dashboard" ? "Dashboard" : pathname.split("/").filter(Boolean)[0]?.replace(/-/g, " ") ?? "";

  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border/60 px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>
      <h1 className="hidden flex-1 text-[13px] font-semibold capitalize tracking-[-0.01em] sm:block">{title}</h1>
      <div className="flex-1 sm:hidden" />

      <Button variant="outline" size="sm" className="hidden gap-2 border-border/70 bg-muted/40 font-normal text-muted-foreground shadow-none hover:bg-muted md:inline-flex" onClick={onOpenCommand}>
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Cari pasien, resep, invoice...</span>
        <kbd className="ml-2 hidden rounded-md border border-border/70 bg-card px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground/80 lg:inline">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenCommand} aria-label="Pencarian">
        <Search className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Ganti tema">
        {mounted && resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <Link href="/notifications" aria-label="Notifikasi">
        <div className="relative">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          {unreadCount > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline">{user.fullName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{user.fullName}</p>
            <p className="text-xs font-normal text-muted-foreground">@{user.username}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.roles.slice(0, 2).map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px]">
                  {r}
                </Badge>
              ))}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserRound className="h-4 w-4" /> Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await logoutAction();
              router.push("/login");
              router.refresh();
            }}
            className="text-destructive"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}