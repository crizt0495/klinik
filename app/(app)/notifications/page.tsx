import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listNotifications } from "@/lib/services/notification";
import { NotificationsView } from "./notifications-view";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const notifications = await listNotifications(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Notifikasi" description="Notifikasi dan pesan sistem." />
      <NotificationsView notifications={notifications} />
    </div>
  );
}