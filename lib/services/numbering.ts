import { sql } from "drizzle-orm";
import { db } from "@/db";
import { counters } from "@/db/schema";

export const ORG_SCOPE_SENTINEL = "00000000-0000-0000-0000-000000000000";

export function branchScope(branchId: string | null | undefined): string {
  return branchId ?? ORG_SCOPE_SENTINEL;
}

/**
 * Atomically allocates the next sequence number for a given counter scope.
 * Uses INSERT ... ON CONFLICT DO UPDATE, which is concurrency-safe
 * (no SELECT MAX + 1 race conditions).
 */
export async function nextSequence(organizationId: string, branchId: string | null, scope: string, period: string | null): Promise<number> {
  const rows = await db()
    .insert(counters)
    .values({ organizationId, branchId: branchScope(branchId), scope, period, sequence: 1 })
    .onConflictDoUpdate({
      target: [counters.organizationId, counters.branchId, counters.scope, counters.period],
      set: { sequence: sql`${counters.sequence} + 1`, updatedAt: new Date() },
    })
    .returning({ sequence: counters.sequence });

  const sequence = rows[0]?.sequence;
  if (typeof sequence !== "number") {
    throw new Error("Gagal membuat nomor urut");
  }
  return sequence;
}

export function datePeriod(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function datePeriodMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export function datePeriodYear(date = new Date()): string {
  return String(date.getFullYear());
}

export function padSequence(seq: number, width = 6): string {
  return String(seq).padStart(width, "0");
}

export function buildNumber(prefix: string, period: string | null, seq: number, width = 6): string {
  const p = period ? `-${period}` : "";
  return `${prefix}${p}-${padSequence(seq, width)}`;
}

export interface NumberOptions {
  organizationId: string;
  branchId: string | null;
  prefix: string;
  scope: string;
  period: string | null;
  width?: number;
}

/**
 * Generates a business number such as MR-20260915-000001, INV-20260915-000001, etc.
 */
export async function generateBusinessNumber(options: NumberOptions): Promise<string> {
  const seq = await nextSequence(options.organizationId, options.branchId, options.scope, options.period);
  return buildNumber(options.prefix, options.period, seq, options.width ?? 6);
}

export async function nextQueueNumber(organizationId: string, branchId: string | null, departmentId: string, queueDate: string): Promise<number> {
  const seq = await nextSequence(organizationId, branchId, `QUEUE-${departmentId}`, queueDate);
  return seq;
}