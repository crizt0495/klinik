import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, isNull, count } from "drizzle-orm";

export async function createNotification(params: {
  organizationId: string;
  branchId?: string | null;
  userId: string;
  type: string;
  title: string;
  message?: string;
  data?: unknown;
}): Promise<void> {
  await db().insert(notifications).values({
    organizationId: params.organizationId,
    branchId: params.branchId ?? null,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    data: params.data ?? undefined,
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db().select({ c: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows[0]?.c ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}