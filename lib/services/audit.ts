import { headers } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, activityLogs, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";

export async function getRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = h.get("user-agent") ?? null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function writeAuditLog(params: {
  user: SessionUser;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  branchId?: string | null;
}): Promise<void> {
  const ctx = await getRequestContext();
  await db().insert(auditLogs).values({
    organizationId: params.user.organizationId,
    branchId: params.branchId ?? params.user.branchId ?? null,
    userId: params.user.id,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    oldData: params.oldData ?? undefined,
    newData: params.newData ?? undefined,
    ipAddress: ctx.ip ? (ctx.ip as never) : undefined,
    userAgent: ctx.userAgent,
  });
}

export async function writeAudit(ctx: {
  organizationId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db().insert(auditLogs).values({
    organizationId: ctx.organizationId,
    branchId: ctx.branchId ?? null,
    userId: ctx.userId ?? null,
    action: ctx.action,
    entityType: ctx.entityType,
    entityId: ctx.entityId ?? null,
    oldData: ctx.oldData ?? undefined,
    newData: ctx.newData ?? undefined,
    ipAddress: ctx.ip ? (ctx.ip as never) : undefined,
    userAgent: ctx.userAgent ?? null,
  });
}

export async function writeActivityLog(params: {
  organizationId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: unknown;
}): Promise<void> {
  await db().insert(activityLogs).values({
    organizationId: params.organizationId,
    branchId: params.branchId ?? null,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    meta: params.meta ?? undefined,
  });
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listAuditLogs(user: SessionUser, filters: AuditLogFilters = {}) {
  const conditions = [eq(auditLogs.organizationId, user.organizationId)];
  if (filters.action?.trim()) conditions.push(eq(auditLogs.action, filters.action.trim()));
  if (filters.entityType?.trim()) conditions.push(eq(auditLogs.entityType, filters.entityType.trim()));
  if (filters.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${`${filters.dateTo} 23:59:59`}`);
  return db()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      userName: sql<string>`coalesce(${users.fullName}, 'System')`,
      ip: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
}