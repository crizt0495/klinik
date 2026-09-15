import { and, eq, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, InsufficientStockError, InvalidStateError, ConflictError } from "@/lib/errors";
import { writeAuditLog, writeActivityLog } from "@/lib/services/audit";

export async function listPrescriptions(user: SessionUser, status?: string) {
  const conditions = [eq(s.prescriptions.organizationId, user.organizationId)];
  if (status) conditions.push(eq(s.prescriptions.status, status));
  return db()
    .select({
      id: s.prescriptions.id,
      number: s.prescriptions.prescriptionNumber,
      status: s.prescriptions.status,
      notes: s.prescriptions.notes,
      issuedAt: s.prescriptions.issuedAt,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      doctorName: s.staff.fullName,
    })
    .from(s.prescriptions)
    .innerJoin(s.patients, eq(s.patients.id, s.prescriptions.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.prescriptions.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .where(and(...conditions))
    .orderBy(desc(s.prescriptions.createdAt));
}

export async function getPrescription(user: SessionUser, id: string) {
  const rows = await db()
    .select({
      id: s.prescriptions.id,
      organizationId: s.prescriptions.organizationId,
      branchId: s.prescriptions.branchId,
      visitId: s.prescriptions.visitId,
      patientId: s.prescriptions.patientId,
      doctorId: s.prescriptions.doctorId,
      prescriptionNumber: s.prescriptions.prescriptionNumber,
      status: s.prescriptions.status,
      notes: s.prescriptions.notes,
      issuedAt: s.prescriptions.issuedAt,
      createdAt: s.prescriptions.createdAt,
      updatedAt: s.prescriptions.updatedAt,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      doctorName: s.staff.fullName,
    })
    .from(s.prescriptions)
    .innerJoin(s.patients, eq(s.patients.id, s.prescriptions.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.prescriptions.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .where(and(eq(s.prescriptions.id, id), eq(s.prescriptions.organizationId, user.organizationId)))
    .limit(1);
  const rx = rows[0];
  if (!rx) throw new NotFoundError("Resep tidak ditemukan");
  const items = await db()
    .select({ id: s.prescriptionItems.id, medicationId: s.prescriptionItems.medicationId, name: s.medications.name, unit: s.medications.unit, quantity: s.prescriptionItems.quantity, dosage: s.prescriptionItems.dosage, frequency: s.prescriptionItems.frequency, route: s.prescriptionItems.route, duration: s.prescriptionItems.duration, instructions: s.prescriptionItems.instructions, dispensedQuantity: s.prescriptionItems.dispensedQuantity, status: s.prescriptionItems.status })
    .from(s.prescriptionItems)
    .innerJoin(s.medications, eq(s.medications.id, s.prescriptionItems.medicationId))
    .where(eq(s.prescriptionItems.prescriptionId, id));
  return { prescription: rx, items };
}

export async function dispensePrescriptionItem(user: SessionUser, prescriptionItemId: string) {
  const rows = await db().select().from(s.prescriptionItems).where(eq(s.prescriptionItems.id, prescriptionItemId)).limit(1);
  const item = rows[0];
  if (!item) throw new NotFoundError("Item resep tidak ditemukan");
  if (item.status === "DISPENSED") throw new InvalidStateError("Item sudah diserahkan");
  const remaining = item.quantity - item.dispensedQuantity;
  if (remaining <= 0) throw new InvalidStateError("Jumlah sudah terpenuhi");
  let toDispense = remaining;

  const batches = await db()
    .select()
    .from(s.inventoryBatches)
    .where(and(
      eq(s.inventoryBatches.organizationId, user.organizationId),
      eq(s.inventoryBatches.branchId, user.branchId ?? ""),
      eq(s.inventoryBatches.medicationId, item.medicationId),
      eq(s.inventoryBatches.status, "ACTIVE"),
      sql`${s.inventoryBatches.quantityAvailable} > 0`,
    ))
    .orderBy(asc(s.inventoryBatches.expiryDate));

  let totalAvailable = 0;
  for (const b of batches) totalAvailable += b.quantityAvailable;
  if (totalAvailable < toDispense) throw new InsufficientStockError(`Stok obat tidak mencukupi (tersedia: ${totalAvailable}, dibutuhkan: ${toDispense})`);

  let dispensedTotal = item.dispensedQuantity;
  const allocations: Array<{ batchId: string; quantity: number }> = [];

  for (const batch of batches) {
    if (toDispense <= 0) break;
    const alloc = Math.min(toDispense, batch.quantityAvailable);
    if (alloc <= 0) continue;
    allocations.push({ batchId: batch.id, quantity: alloc });
    await db().update(s.inventoryBatches).set({ quantityAvailable: sql`${s.inventoryBatches.quantityAvailable} - ${alloc}`, updatedAt: new Date() }).where(eq(s.inventoryBatches.id, batch.id));
    await db().insert(s.inventoryTransactions).values({ organizationId: user.organizationId, branchId: user.branchId ?? "", medicationId: item.medicationId, batchId: batch.id, transactionType: "DISPENSE", quantity: -alloc, referenceType: "prescription_items", referenceId: prescriptionItemId, reason: `Dispensing resep`, performedBy: user.id });
    toDispense -= alloc;
    dispensedTotal += alloc;
  }

  if (allocations.length > 0) {
    await db().insert(s.prescriptionBatchAllocations).values(allocations.map((a) => ({ prescriptionItemId, batchId: a.batchId, quantity: a.quantity })));
  }

  const newStatus = dispensedTotal >= item.quantity ? "DISPENSED" : "PARTIAL";
  await db().update(s.prescriptionItems).set({ dispensedQuantity: dispensedTotal, status: newStatus, updatedAt: new Date() }).where(eq(s.prescriptionItems.id, prescriptionItemId));

  // Update parent prescription status
  const prescriptionId = item.prescriptionId;
  const allItems = await db().select({ status: s.prescriptionItems.status }).from(s.prescriptionItems).where(eq(s.prescriptionItems.prescriptionId, prescriptionId));
  const allDispensed = allItems.every((i) => i.status === "DISPENSED");
  const anyDispensed = allItems.some((i) => i.status !== "PENDING");
  const prescriptionStatus = allDispensed ? "DISPENSED" : anyDispensed ? "PARTIALLY_DISPENSED" : "ISSUED";
  await db().update(s.prescriptions).set({ status: prescriptionStatus, updatedAt: new Date() }).where(eq(s.prescriptions.id, prescriptionId));

  await writeAuditLog({ user, action: "DISPENSE_ITEM", entityType: "prescription_items", entityId: prescriptionItemId, newData: { dispensedQuantity: dispensedTotal, batchAllocations: allocations.length } });
  await writeActivityLog({ organizationId: user.organizationId, branchId: user.branchId, userId: user.id, action: "prescription_item_dispensed", entityType: "prescription_items", entityId: prescriptionItemId });
}

export async function listPharmacyQueue(user: SessionUser) {
  return db()
    .select({
      id: s.prescriptions.id,
      number: s.prescriptions.prescriptionNumber,
      status: s.prescriptions.status,
      patientName: s.patients.fullName,
      patientMrn: s.patients.medicalRecordNumber,
      doctorName: s.staff.fullName,
      issuedAt: s.prescriptions.issuedAt,
      itemCount: sql<number>`(SELECT count(*)::int FROM prescription_items WHERE prescription_items.prescription_id = prescriptions.id)`,
      dispensedCount: sql<number>`(SELECT count(*)::int FROM prescription_items WHERE prescription_items.prescription_id = prescriptions.id AND prescription_items.status = 'DISPENSED')`,
    })
    .from(s.prescriptions)
    .innerJoin(s.patients, eq(s.patients.id, s.prescriptions.patientId))
    .innerJoin(s.doctors, eq(s.doctors.id, s.prescriptions.doctorId))
    .innerJoin(s.staff, eq(s.staff.id, s.doctors.staffId))
    .where(and(
      eq(s.prescriptions.organizationId, user.organizationId),
      eq(s.prescriptions.branchId, user.branchId ?? ""),
      sql`${s.prescriptions.status} IN ('ISSUED','PARTIALLY_DISPENSED')`,
    ))
    .orderBy(desc(s.prescriptions.issuedAt));
}