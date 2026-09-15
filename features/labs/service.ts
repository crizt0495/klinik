import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export async function listLabOrders(user: SessionUser) {
  return db()
    .select({
      id: s.laboratoryOrders.id,
      orderNumber: s.laboratoryOrders.orderNumber,
      status: s.laboratoryOrders.status,
      visitNumber: s.visits.visitNumber,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      createdAt: s.laboratoryOrders.createdAt,
    })
    .from(s.laboratoryOrders)
    .innerJoin(s.visits, eq(s.visits.id, s.laboratoryOrders.visitId))
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .where(eq(s.laboratoryOrders.organizationId, user.organizationId))
    .orderBy(desc(s.laboratoryOrders.createdAt));
}

export async function createLabOrder(user: SessionUser, data: { visitId: string; tests: Array<{ testName: string; specimenType: string; clinicalInfo?: string }> }) {
  const visitRows = await db().select().from(s.visits).where(eq(s.visits.id, data.visitId)).limit(1);
  const visit = visitRows[0];
  if (!visit) throw new NotFoundError("Kunjungan tidak ditemukan");
  const number = `LAB-${Date.now()}`;
  const [order] = await db().insert(s.laboratoryOrders).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", visitId: data.visitId, patientId: visit.patientId, orderNumber: number, status: "ORDERED",
  }).returning({ id: s.laboratoryOrders.id });

  for (const t of data.tests) {
    await db().insert(s.laboratoryOrderItems).values({ laboratoryOrderId: order.id, testCode: t.testName, testName: t.testName, notes: t.clinicalInfo ?? null, status: "ORDERED" });
  }

  await writeAuditLog({ user, action: "CREATE", entityType: "lab_orders", entityId: order.id, newData: { orderNumber: number, testCount: data.tests.length } });
  return order;
}

export async function completeLabOrder(user: SessionUser, labOrderId: string, results: Array<{ labOrderTestId: string; resultValue: string; unit?: string; referenceRange?: string; flags?: string; notes?: string }>) {
  const rows = await db().select().from(s.laboratoryOrders).where(and(eq(s.laboratoryOrders.id, labOrderId), eq(s.laboratoryOrders.organizationId, user.organizationId))).limit(1);
  if (!rows[0]) throw new NotFoundError("Order lab tidak ditemukan");

  for (const r of results) {
    await db().update(s.laboratoryOrderItems).set({
      resultValue: r.resultValue, unit: r.unit ?? null, referenceRange: r.referenceRange ?? null, resultFlag: r.flags ?? null, notes: r.notes ?? null, status: "COMPLETED", processedBy: user.id, updatedAt: new Date(),
    }).where(eq(s.laboratoryOrderItems.id, r.labOrderTestId));
  }

  await db().update(s.laboratoryOrders).set({ status: "COMPLETED", completedAt: new Date() }).where(eq(s.laboratoryOrders.id, labOrderId));
  await writeAuditLog({ user, action: "COMPLETE_LAB", entityType: "lab_orders", entityId: labOrderId, newData: { resultCount: results.length } });
}

export async function listRadiologyOrders(user: SessionUser) {
  return db()
    .select({
      id: s.radiologyOrders.id,
      orderNumber: s.radiologyOrders.orderNumber,
      status: s.radiologyOrders.status,
      visitNumber: s.visits.visitNumber,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      createdAt: s.radiologyOrders.createdAt,
    })
    .from(s.radiologyOrders)
    .innerJoin(s.visits, eq(s.visits.id, s.radiologyOrders.visitId))
    .innerJoin(s.patients, eq(s.patients.id, s.visits.patientId))
    .where(eq(s.radiologyOrders.organizationId, user.organizationId))
    .orderBy(desc(s.radiologyOrders.createdAt));
}

export async function createRadiologyOrder(user: SessionUser, data: { visitId: string; images: Array<{ examType: string; bodyPart: string; clinicalInfo?: string; modality?: string }> }) {
  const visitRows = await db().select().from(s.visits).where(eq(s.visits.id, data.visitId)).limit(1);
  const visit = visitRows[0];
  if (!visit) throw new NotFoundError("Kunjungan tidak ditemukan");
  const number = `RAD-${Date.now()}`;
  const [order] = await db().insert(s.radiologyOrders).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", visitId: data.visitId, patientId: visit.patientId, orderNumber: number, status: "ORDERED", procedureName: data.images[0]?.examType ?? "RADIOLOGY", clinicalInformation: data.images[0]?.clinicalInfo ?? null,
  }).returning({ id: s.radiologyOrders.id });

  await writeAuditLog({ user, action: "CREATE", entityType: "radiology_orders", entityId: order.id, newData: { orderNumber: number, imageCount: data.images.length } });
  return order;
}