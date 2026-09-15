"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export interface Notification { id: string; type: string; title: string; message: string; isRead: boolean; link: string | null; createdAt: Date | string }

export function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const unread = notifications.filter((n) => !n.isRead);

  async function markAllRead() {
    try {
      await fetch("/api/notifications/mark-read", { method: "POST", body: JSON.stringify({ markAll: true }) });
      toast.success("Semua notifikasi ditandai sudah dibaca");
      router.refresh();
    } catch { toast.error("Gagal"); }
  }

  return (
    <div className="space-y-4">
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{unread.length} belum dibaca</p>
          <Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-1" /> Tandai Semua Dibaca</Button>
        </div>
      )}
      {notifications.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />Tidak ada notifikasi.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={!n.isRead ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="mt-0.5">{n.isRead ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}