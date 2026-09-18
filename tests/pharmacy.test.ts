import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { registerVisit, createPrescription } from "@/features/visits/service";
import { getPrescription, dispensePrescriptionItem, listPrescriptions, listPharmacyQueue } from "@/features/pharmacy/service";
import { listInventory } from "@/features/inventory/service";
import { InsufficientStockError, InvalidStateError, NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let doctor: SessionUser;
let receptionist: SessionUser;
let pharmacist: SessionUser;
let doctorId: string;
let departmentId: string;
let seededMedId: string;

async function newCase(name: string) {
  const patient = await createPatient(receptionist, { fullName: name, gender: "MALE" });
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

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  pharmacist = (await loginWithPassword("pharmacist", "Pharmacist@2026")).sessionUser;
  doctorId = (await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1))[0].id;
  departmentId = (await db().select({ id: s.departments.id }).from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0].id;
  seededMedId = (await db().select({ id: s.medications.id }).from(s.medications).where(eq(s.medications.organizationId, admin.organizationId)).orderBy(asc(s.medications.code)).limit(1))[0].id;
}, 120000);

describe("modul farmasi & dispensing", () => {
  it("1. createPrescription membuat resep ISSUED dengan nomor RX", async () => {
    const { patient, visit } = await newCase("Resep Dasar");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: seededMedId, quantity: 3 }]);
    expect(rx.status).toBe("ISSUED");
    expect(rx.prescriptionNumber).toMatch(/^RX-/);
  });

  it("2. item resep default route ORAL", async () => {
    const { patient, visit } = await newCase("Resep Route");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: seededMedId, quantity: 2 }]);
    const detail = await getPrescription(pharmacist, rx.id);
    expect(detail.items[0].route).toBe("ORAL");
    expect(detail.items[0].status).toBe("PENDING");
  });

  it("3. getPrescription memuat nama pasien & dokter", async () => {
    const { patient, visit } = await newCase("Resep Nama");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: seededMedId, quantity: 1 }]);
    const detail = await getPrescription(pharmacist, rx.id);
    expect(detail.prescription.patientName).toBe("Resep Nama");
    expect(detail.prescription.doctorName).toBeTruthy();
  });

  it("4. listPrescriptions dapat difilter status ISSUED", async () => {
    const { patient, visit } = await newCase("Resep Filter");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: seededMedId, quantity: 1 }]);
    const issued = await listPrescriptions(pharmacist, "ISSUED");
    expect(issued.some((r) => r.id === rx.id)).toBe(true);
  });

  it("5. dispensing penuh mengubah item & resep menjadi DISPENSED", async () => {
    const medId = await newMedication("OBT-PHARM-FULL");
    await addBatch(medId, "2029-01-01", 20);
    const { patient, visit } = await newCase("Resep Dispense Penuh");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 5 }]);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await dispensePrescriptionItem(pharmacist, item.id);
    const after = await getPrescription(pharmacist, rx.id);
    expect(after.items[0].status).toBe("DISPENSED");
    expect(after.items[0].dispensedQuantity).toBe(5);
    expect(after.prescription.status).toBe("DISPENSED");
  });

  it("6. resep yang sudah diserahkan hilang dari antrian farmasi", async () => {
    const medId = await newMedication("OBT-PHARM-QUEUE");
    await addBatch(medId, "2029-01-01", 10);
    const { patient, visit } = await newCase("Resep Antrian");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 2 }]);
    expect((await listPharmacyQueue(pharmacist)).some((r) => r.id === rx.id)).toBe(true);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await dispensePrescriptionItem(pharmacist, item.id);
    expect((await listPharmacyQueue(pharmacist)).some((r) => r.id === rx.id)).toBe(false);
  });

  it("7. FEFO: batch kedaluwarsa lebih dulu dipakai", async () => {
    const medId = await newMedication("OBT-PHARM-FEFO");
    const early = await addBatch(medId, "2027-01-01", 5);
    const late = await addBatch(medId, "2029-01-01", 5);
    const { patient, visit } = await newCase("Resep FEFO");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 7 }]);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await dispensePrescriptionItem(pharmacist, item.id);
    const earlyRow = (await db().select().from(s.inventoryBatches).where(eq(s.inventoryBatches.id, early)))[0];
    const lateRow = (await db().select().from(s.inventoryBatches).where(eq(s.inventoryBatches.id, late)))[0];
    expect(earlyRow.quantityAvailable).toBe(0);
    expect(lateRow.quantityAvailable).toBe(3);
  });

  it("8. dispensing ganda pada item yang sudah diserahkan ditolak", async () => {
    const medId = await newMedication("OBT-PHARM-DOUBLE");
    await addBatch(medId, "2029-01-01", 10);
    const { patient, visit } = await newCase("Resep Dispense Ganda");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 2 }]);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await dispensePrescriptionItem(pharmacist, item.id);
    await expect(dispensePrescriptionItem(pharmacist, item.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("9. dispensing tanpa stok ditolak", async () => {
    const medId = await newMedication("OBT-PHARM-NOSTOCK");
    const { patient, visit } = await newCase("Resep Tanpa Stok");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 2 }]);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await expect(dispensePrescriptionItem(pharmacist, item.id)).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("10. dispensing item yang tidak ada menolak 404", async () => {
    await expect(dispensePrescriptionItem(pharmacist, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("11. stok obat berkurang setelah dispensing", async () => {
    const medId = await newMedication("OBT-PHARM-STOCK");
    const batchId = await addBatch(medId, "2029-01-01", 30);
    const before = (await listInventory(admin)).find((i) => i.batchId === batchId)?.quantityAvailable ?? 0;
    const { patient, visit } = await newCase("Resep Stok Turun");
    const rx = await createPrescription(doctor, visit.id, patient.id, doctorId, [{ medicationId: medId, quantity: 4 }]);
    const item = (await getPrescription(pharmacist, rx.id)).items[0];
    await dispensePrescriptionItem(pharmacist, item.id);
    const after = (await listInventory(admin)).find((i) => i.batchId === batchId)?.quantityAvailable ?? 0;
    expect(after).toBe(before - 4);
  });
});
