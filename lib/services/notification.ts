import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, isNull, count, desc, sql } from "drizzle-orm";
import type { SessionUser } from "@/lib/auth/session";

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

export async function listNotifications(user: SessionUser) {
  return db()
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: sql<string>`coalesce(${notifications.message}, '')`,
      isRead: sql<boolean>`${notifications.readAt} is not null`,
      link: sql<string | null>`${notifications.data}->>'link'`,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}