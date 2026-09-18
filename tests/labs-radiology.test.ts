import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createPatient } from "@/features/patients/service";
import { registerVisit } from "@/features/visits/service";
import { createLabOrder, listLabOrders, completeLabOrder, getLabOrder, createRadiologyOrder, listRadiologyOrders, getRadiologyOrder } from "@/features/labs/service";
import { NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let receptionist: SessionUser;
let labUser: SessionUser;
let radUser: SessionUser;
let doctorId: string;
let departmentId: string;

async function newVisit(name: string) {
  const patient = await createPatient(receptionist, { fullName: name, gender: "FEMALE" });
  const res = await registerVisit(receptionist, { patientId: patient.id, doctorId, departmentId });
  return res.visit;
}

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  receptionist = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
  labUser = (await loginWithPassword("lab", "Lab@2026")).sessionUser;
  radUser = (await loginWithPassword("radiology", "Radiology@2026")).sessionUser;
  doctorId = (await db().select({ id: s.doctors.id }).from(s.doctors).where(eq(s.doctors.organizationId, admin.organizationId)).limit(1))[0].id;
  departmentId = (await db().select({ id: s.departments.id }).from(s.departments).where(and(eq(s.departments.organizationId, admin.organizationId), eq(s.departments.code, "UMUM"))).limit(1))[0].id;
}, 120000);

describe("modul laboratorium & radiologi", () => {
  it("1. createLabOrder membuat order ORDERED dengan nomor LAB", async () => {
    const visit = await newVisit("Lab Order");
    const order = await createLabOrder(labUser, { visitId: visit.id, tests: [{ testName: "Darah Lengkap", specimenType: "DARAH" }, { testName: "Gula Darah", specimenType: "DARAH" }] });
    const items = await db().select().from(s.laboratoryOrderItems).where(eq(s.laboratoryOrderItems.laboratoryOrderId, order.id));
    expect(items).toHaveLength(2);
    const detail = await getLabOrder(labUser, order.id);
    expect(detail.order.status).toBe("ORDERED");
    expect(detail.order.orderNumber).toMatch(/^LAB-/);
  });

  it("2. listLabOrders memuat nomor kunjungan & pasien", async () => {
    const visit = await newVisit("Lab List");
    const order = await createLabOrder(labUser, { visitId: visit.id, tests: [{ testName: "Hematokrit", specimenType: "DARAH" }] });
    const row = (await listLabOrders(labUser)).find((o) => o.id === order.id);
    expect(row?.visitNumber).toBeTruthy();
    expect(row?.patientName).toBe("Lab List");
  });

  it("3. completeLabOrder menyelesaikan order & item", async () => {
    const visit = await newVisit("Lab Selesai");
    const order = await createLabOrder(labUser, { visitId: visit.id, tests: [{ testName: "Hemoglobin", specimenType: "DARAH" }] });
    const items = await db().select().from(s.laboratoryOrderItems).where(eq(s.laboratoryOrderItems.laboratoryOrderId, order.id)).orderBy(asc(s.laboratoryOrderItems.testName));
    await completeLabOrder(labUser, order.id, [{ labOrderTestId: items[0].id, resultValue: "13.5", unit: "g/dL", referenceRange: "12-16", flags: "NORMAL" }]);
    const detail = await getLabOrder(labUser, order.id);
    expect(detail.order.status).toBe("COMPLETED");
    expect(detail.items[0].status).toBe("COMPLETED");
  });

  it("4. getLabOrder mengembalikan hasil & referensi kunjungan", async () => {
    const visit = await newVisit("Lab Detail");
    const order = await createLabOrder(labUser, { visitId: visit.id, tests: [{ testName: "Trombosit", specimenType: "DARAH" }] });
    const detail = await getLabOrder(labUser, order.id);
    expect(detail.order.visitNumber).toBeTruthy();
    expect(detail.items.length).toBe(1);
  });

  it("5. completeLabOrder untuk order tidak ada ditolak 404", async () => {
    await expect(completeLabOrder(labUser, "00000000-0000-0000-0000-000000000000", [])).rejects.toBeInstanceOf(NotFoundError);
  });

  it("6. createLabOrder untuk kunjungan tidak ada ditolak 404", async () => {
    await expect(createLabOrder(labUser, { visitId: "00000000-0000-0000-0000-000000000000", tests: [{ testName: "x", specimenType: "DARAH" }] })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("7. getLabOrder tidak ditemukan menolak 404", async () => {
    await expect(getLabOrder(labUser, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("8. createRadiologyOrder membuat order ORDERED dengan nomor RAD", async () => {
    const visit = await newVisit("Rad Order");
    const order = await createRadiologyOrder(radUser, { visitId: visit.id, images: [{ examType: "X-Ray Thorax", bodyPart: "DADA", modality: "X-RAY" }] });
    const detail = await getRadiologyOrder(radUser, order.id);
    expect(detail.order.status).toBe("ORDERED");
    expect(detail.order.orderNumber).toMatch(/^RAD-/);
    expect(detail.order.procedureName).toBe("X-Ray Thorax");
  });

  it("9. listRadiologyOrders memuat order radiologi", async () => {
    const visit = await newVisit("Rad List");
    const order = await createRadiologyOrder(radUser, { visitId: visit.id, images: [{ examType: "USG Abdomen", bodyPart: "ABDOMEN" }] });
    const row = (await listRadiologyOrders(radUser)).find((o) => o.id === order.id);
    expect(row?.patientName).toBe("Rad List");
  });

  it("10. getRadiologyOrder memuat informasi klinis", async () => {
    const visit = await newVisit("Rad Info");
    const order = await createRadiologyOrder(radUser, { visitId: visit.id, images: [{ examType: "CT Scan Kepala", bodyPart: "KEPALA", clinicalInfo: "Trauma ringan", modality: "CT" }] });
    const detail = await getRadiologyOrder(radUser, order.id);
    expect(detail.order.clinicalInformation).toBe("Trauma ringan");
    expect(detail.order.visitNumber).toBeTruthy();
  });

  it("11. createRadiologyOrder untuk kunjungan tidak ada ditolak 404", async () => {
    await expect(createRadiologyOrder(radUser, { visitId: "00000000-0000-0000-0000-000000000000", images: [{ examType: "X-Ray", bodyPart: "DADA" }] })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("12. getRadiologyOrder tidak ditemukan menolak 404", async () => {
    await expect(getRadiologyOrder(radUser, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});
