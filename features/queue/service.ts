import { and, eq, isNull, desc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { todayISO } from "@/lib/utils";
import { nextQueueNumber } from "@/lib/services/numbering";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export async function listPatientsForQueue(user: SessionUser) {
  return db()
    .select({ id: s.patients.id, fullName: s.patients.fullName, medicalRecordNumber: s.patients.medicalRecordNumber })
    .from(s.patients)
    .where(and(eq(s.patients.organizationId, user.organizationId), isNull(s.patients.deletedAt), eq(s.patients.status, "ACTIVE")))
    .orderBy(s.patients.fullName)
    .limit(200);
}

export async function listDepartmentsForQueue(user: SessionUser) {
  return db()
    .select({ id: s.departments.id, name: s.departments.name, code: s.departments.code })
    .from(s.departments)
    .where(and(eq(s.departments.organizationId, user.organizationId), eq(s.departments.status, "ACTIVE")))
    .orderBy(s.departments.name);
}

export async function listQueuesToday(user: SessionUser, departmentId?: string) {
  const today = todayISO();
  const conditions = [
    eq(s.queues.organizationId, user.organizationId),
    eq(s.queues.branchId, user.branchId ?? ""),
    eq(s.queues.queueDate, today),
  ];
  if (departmentId) conditions.push(eq(s.queues.departmentId, departmentId));
  return db()
    .select({
      id: s.queues.id,
      queueNumber: s.queues.queueNumber,
      queueCode: s.queues.queueCode,
      priority: s.queues.priority,
      status: s.queues.status,
      queueDate: s.queues.queueDate,
      calledAt: s.queues.calledAt,
      servedAt: s.queues.servedAt,
      completedAt: s.queues.completedAt,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      patientId: s.patients.id,
      departmentId: s.queues.departmentId,
      departmentName: s.departments.name,
      departmentCode: s.departments.code,
      visitId: s.queues.visitId,
    })
    .from(s.queues)
    .innerJoin(s.patients, eq(s.patients.id, s.queues.patientId))
    .innerJoin(s.departments, eq(s.departments.id, s.queues.departmentId))
    .where(and(...conditions))
    .orderBy(s.queues.queueNumber);
}

export async function createQueueEntry(user: SessionUser, patientId: string, departmentId: string, priority = "NORMAL") {
  const today = todayISO();
  const dept = await db().select().from(s.departments).where(and(eq(s.departments.id, departmentId), eq(s.departments.organizationId, user.organizationId))).limit(1);
  if (dept.length === 0) throw new NotFoundError("Departemen tidak ditemukan");
  const seq = await nextQueueNumber(user.organizationId, user.branchId, departmentId, today);
  const queueCode = `${dept[0].code}-${String(seq).padStart(3, "0")}`;
  const inserted = await db()
    .insert(s.queues)
    .values({
      organizationId: user.organizationId,
      branchId: user.branchId ?? "",
      departmentId,
      patientId,
      queueDate: today,
      queueNumber: seq,
      queueCode,
      priority,
      status: "WAITING",
    })
    .returning();
  const q = inserted[0];
  await writeAuditLog({ user, action: "QUEUE_CREATE", entityType: "queues", entityId: q.id, newData: { queueCode, patientId, departmentId } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "queue_created", entityType: "queues", entityId: q.id });
  return q;
}

export async function updateQueueStatus(user: SessionUser, queueId: string, newStatus: string) {
  const allowed: Record<string, { valid: string[]; patch: Record<string, Date | string> }> = {
    CALLED: { valid: ["WAITING"], patch: { calledAt: new Date(), status: "CALLED" } },
    SERVING: { valid: ["CALLED"], patch: { servedAt: new Date(), status: "SERVING" } },
    COMPLETED: { valid: ["SERVING"], patch: { completedAt: new Date(), status: "COMPLETED" } },
    CANCELLED: { valid: ["WAITING", "CALLED"], patch: { status: "CANCELLED" } },
    SKIPPED: { valid: ["WAITING", "CALLED"], patch: { status: "SKIPPED" } },
  };
  const rule = allowed[newStatus];
  if (!rule) throw new ConflictError(`Status transisi "${newStatus}" tidak dikenal`);
  // Guarded update: hanya berhasil jika status saat ini masih termasuk transisi yang
  // diizinkan (atomik), sehingga dua operator tidak bisa memutakhirkan antrian yang sama
  // secara paralel / dari status yang sudah basi.
  const updated = await db()
    .update(s.queues)
    .set(rule.patch)
    .where(and(eq(s.queues.id, queueId), eq(s.queues.organizationId, user.organizationId), inArray(s.queues.status, rule.valid)))
    .returning();

  const q = updated[0];
  if (!q) {
    const current = await getQueue(user, queueId);
    throw new ConflictError(`Tidak dapat mengubah status dari ${current.status} ke ${newStatus}`);
  }

  await writeAuditLog({ user, action: `QUEUE_${newStatus}`, entityType: "queues", entityId: queueId, newData: { status: newStatus } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: `queue_${newStatus.toLowerCase()}`, entityType: "queues", entityId: queueId });
  return q;
}

export async function getQueue(user: SessionUser, id: string) {
  const rows = await db().select().from(s.queues).where(and(eq(s.queues.id, id), eq(s.queues.organizationId, user.organizationId))).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Antrian tidak ditemukan");
  return row;
}

export async function getQueueStatsToday(user: SessionUser, departmentId: string) {
  const today = todayISO();
  const rows = await db()
    .select({ status: s.queues.status, c: sql<number>`count(*)::int` })
    .from(s.queues)
    .where(and(eq(s.queues.organizationId, user.organizationId), eq(s.queues.branchId, user.branchId ?? ""), eq(s.queues.queueDate, today), eq(s.queues.departmentId, departmentId)))
    .groupBy(s.queues.status);
  return rows;
}