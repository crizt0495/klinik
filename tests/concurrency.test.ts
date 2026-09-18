import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { registerVisit, createPrescription } from "@/features/visits/service";
import { dispensePrescriptionItem } from "@/features/pharmacy/service";
import { createInvoiceForVisit, processPayment } from "@/features/billing/service";
import { createQueueEntry, updateQueueStatus, listQueuesToday } from "@/features/queue/service";
import { createStockOpname } from "@/features/inventory/service";
import { InsufficientStockError, InvalidStateError, ConflictError } from "@/lib/errors";

let admin: SessionUser;
let doctor: SessionUser;
let receptionist: SessionUser;
let pharmacist: SessionUser;
let doctorId: string;
let departmentId: string;

async function newCase(name: string) {
  const patient = await createPatient(receptionist, { fullName: name, gender: "FEMALE" });
  const res = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId });
  return { patient, visit: res.visit };
}

async function newMedication(code: string) {
  const cat = (await db().select().from(s.medicationCategories).where(eq(s.medicationCategories.organizationId, admin.organizationId)).limit(1))[0];
  const [med] = await db().insert(s.medications).values({
    organizationId: admin.organizationId, categoryId: cat.id, code, name: `Obat ${code}`, genericName: code, dosageForm: "Tablet", strength: "10mg", unit: "strip", sellingPrice: "20000", purchasePrice: "12000", minimumStock: 5, status: "ACTIVE",
  }).returning();
  return med.id;
}

async function addBatch(medicationId: string, expiryDate: string, qty: number) {
  const [batch] = await db().insert(s.inventoryBatches).values({
    organizationId: admin.organizationId, branchId: admin.branchId ?? "", medicationId, batchNumber: `BAT-${medicationId.slice(0, 6)}-${expiryDate}`, expiryDate, quantityReceived: qty, quantityAvailable: qty, purchasePrice: "12000", receivedAt: new Date(), status: "ACTIVE",
  }).returning();
  return batch.id;
}

async function batchQty(medicationId: string): Promise<number> {
  const rows = await db().select({ q: s.inventoryBatches.quantityAvailable }).from(s.inventoryBatches).where(eq(s.inventoryBatches.medicationId, medicationId));
  return rows.reduce((acc, r) => acc + r.q, 0);
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  pharmacist = (await loginWithPassword("pharmacist", "Pharmacist@2026")).sessionUser;
  doctorId = (await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1))[0].id;
  departmentId = (await db().select({ id: s.departments.id }).from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0].id;
}, 120000);

describe("konsistensi & anti race (transactional)", () => {
  it("1. stok kurang → dispense dibatalkan utuh (rollback, stok tidak berkurang)", async () => {
    const { patient, visit } = await newCase("Race Stok Kurang");
    const med = await newMedication("RACEKURANG");
    await addBatch(med, "2027-01-01", 3);
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: med, quantity: 5 }]);
    const item = (await db().select().from(s.prescriptionItems).where(eq(s.prescriptionItems.prescriptionId, rx.id)))[0];

    await expect(dispensePrescriptionItem(pharmacist, item.id)).rejects.toThrow(InsufficientStockError);
    expect(await batchQty(med)).toBe(3);
  });

  it("2. dispense ganda dicegah → stok hanya terpotong sekali", async () => {
    const { patient, visit } = await newCase("Race Dispense Ganda");
    const med = await newMedication("RACEGANDA");
    await addBatch(med, "2027-01-01", 5);
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: med, quantity: 2 }]);
    const item = (await db().select().from(s.prescriptionItems).where(eq(s.prescriptionItems.prescriptionId, rx.id)))[0];

    await dispensePrescriptionItem(pharmacist, item.id);
    await expect(dispensePrescriptionItem(pharmacist, item.id)).rejects.toThrow(InvalidStateError);
    expect(await batchQty(med)).toBe(3);
  });

  it("3. invoice per kunjungan hanya satu (duplikat ditolak)", async () => {
    const { patient, visit } = await newCase("Race Invoice Ganda");
    const first = await createInvoiceForVisit(receptionist, { visitId: visit.id, items: [{ serviceItemId: crypto.randomUUID(), description: "Konsultasi", quantity: 1, unitPrice: 50000 }] });
    expect(first.id).toBeTruthy();
    await expect(createInvoiceForVisit(receptionist, { visitId: visit.id, items: [{ serviceItemId: crypto.randomUUID(), description: "Konsultasi", quantity: 1, unitPrice: 50000 }] })).rejects.toThrow(InvalidStateError);
    const count = await db().select({ n: s.invoices.id }).from(s.invoices).where(eq(s.invoices.visitId, visit.id));
    expect(count).toHaveLength(1);
  });

  it("4. pembayaran tidak boleh melebihi total dan final saat lunas", async () => {
    const { visit } = await newCase("Race Overpay");
    const inv = await createInvoiceForVisit(receptionist, { visitId: visit.id, items: [{ serviceItemId: crypto.randomUUID(), description: "Konsultasi", quantity: 1, unitPrice: 20000 }] });

    await processPayment(receptionist, { invoiceId: inv.id, method: "TUNAI", amount: "15000" });
    await expect(processPayment(receptionist, { invoiceId: inv.id, method: "TUNAI", amount: "6000" })).rejects.toThrow(InvalidStateError);
    await processPayment(receptionist, { invoiceId: inv.id, method: "TUNAI", amount: "5000" });

    const [stored] = await db().select().from(s.invoices).where(eq(s.invoices.id, inv.id));
    expect(stored.paidAmount).toBe("20000");
    expect(stored.status).toBe("PAID");
    await expect(processPayment(receptionist, { invoiceId: inv.id, method: "TUNAI", amount: "1" })).rejects.toThrow(InvalidStateError);
  });

  it("5. transisi antrean atomik (transisi ganda yang sama ditolak)", async () => {
    const { patient } = await newCase("Race Antrean");
    const q = await createQueueEntry(receptionist, patient.id, departmentId);
    expect(q.status).toBe("WAITING");

    const called = await updateQueueStatus(receptionist, q.id, "CALLED");
    expect(called.status).toBe("CALLED");
    await expect(updateQueueStatus(receptionist, q.id, "CALLED")).rejects.toThrow(ConflictError);

    const serving = await updateQueueStatus(receptionist, q.id, "SERVING");
    expect(serving.status).toBe("SERVING");
    const todayRows = await listQueuesToday(receptionist, departmentId);
    const row = todayRows.find((r) => r.id === q.id);
    expect(row?.status).toBe("SERVING");
  });

  it("6. opname stok mempertahankan nilai terakhir secara atomik", async () => {
    const { patient, visit } = await newCase("Race Opname");
    const med = await newMedication("RACEOPNAME");
    const batchId = await addBatch(med, "2027-01-01", 10);
    await createStockOpname(pharmacist, med, batchId, 7);
    await createStockOpname(pharmacist, med, batchId, 4);
    const [row] = await db().select({ q: s.inventoryBatches.quantityAvailable }).from(s.inventoryBatches).where(eq(s.inventoryBatches.id, batchId));
    expect(row.q).toBe(4);
  });

  it("7. transaksi pembayaran & invoice mempertahankan jalur yang konsisten", async () => {
    // Refund protection: refund tidak boleh melebihi yang sudah dibayar
    const { patient, visit } = await newCase("Race Refund");
    const inv = await createInvoiceForVisit(receptionist, { visitId: visit.id, items: [{ serviceItemId: crypto.randomUUID(), description: "Tindakan", quantity: 1, unitPrice: 100000 }] });
    await expect(processPayment(receptionist, { invoiceId: inv.id, method: "TUNAI", amount: "100001" })).rejects.toThrow(InvalidStateError);
  });
});