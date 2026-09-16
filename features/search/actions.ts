"use server";

import { and, eq, ilike, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { patients, doctors, staff, medications, invoices, prescriptions, appointments, suppliers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";

export interface SearchResult {
  type: string;
  label: string;
  sublabel: string;
  href: string;
}

export async function globalSearchAction(query: string, limit = 6): Promise<SearchResult[]> {
  const user = await getSessionUser();
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  const results: SearchResult[] = [];

  if (user.isSuperAdmin || user.permissions.has("patients.view")) {
    const p = await db()
      .select({ id: patients.id, name: patients.fullName, mrn: patients.medicalRecordNumber, nik: patients.nik })
      .from(patients)
      .where(and(eq(patients.organizationId, user.organizationId), isNull(patients.deletedAt), or(ilike(patients.fullName, pattern), ilike(patients.medicalRecordNumber, pattern), patients.nik ? ilike(patients.nik, pattern) : undefined)))
      .limit(limit);
    results.push(...p.map((r) => ({ type: "Pasien", label: r.name, sublabel: `${r.mrn}${r.nik ? ` · ${r.nik}` : ""}`, href: `/patients/${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("appointments.view")) {
    const d = await db()
      .select({ id: doctors.id, name: staff.fullName, spec: doctors.specialization })
      .from(doctors)
      .innerJoin(staff, eq(staff.id, doctors.staffId))
      .where(and(eq(doctors.organizationId, user.organizationId), ilike(staff.fullName, pattern)))
      .limit(limit);
    results.push(...d.map((r) => ({ type: "Dokter", label: r.name, sublabel: r.spec ?? "Dokter", href: `/doctors/${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("appointments.view")) {
    const a = await db()
      .select({ id: appointments.id, number: appointments.appointmentNumber, date: appointments.appointmentDate })
      .from(appointments)
      .where(and(eq(appointments.organizationId, user.organizationId), ilike(appointments.appointmentNumber, pattern)))
      .limit(limit);
    results.push(...a.map((r) => ({ type: "Appointment", label: r.number, sublabel: r.date, href: `/appointments/${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("pharmacy.view")) {
    const m = await db()
      .select({ id: medications.id, name: medications.name, code: medications.code })
      .from(medications)
      .where(and(eq(medications.organizationId, user.organizationId), or(ilike(medications.name, pattern), ilike(medications.code, pattern))))
      .limit(limit);
    results.push(...m.map((r) => ({ type: "Obat", label: r.name, sublabel: r.code, href: `/inventory?medication=${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("billing.view")) {
    const inv = await db()
      .select({ id: invoices.id, number: invoices.invoiceNumber, total: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.organizationId, user.organizationId), ilike(invoices.invoiceNumber, pattern)))
      .limit(limit);
    results.push(...inv.map((r) => ({ type: "Invoice", label: r.number, sublabel: `Total: ${r.total}`, href: `/billing/${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("prescriptions.view")) {
    const rx = await db()
      .select({ id: prescriptions.id, number: prescriptions.prescriptionNumber, status: prescriptions.status })
      .from(prescriptions)
      .where(and(eq(prescriptions.organizationId, user.organizationId), ilike(prescriptions.prescriptionNumber, pattern)))
      .limit(limit);
    results.push(...rx.map((r) => ({ type: "Resep", label: r.number, sublabel: r.status, href: `/prescriptions/${r.id}` })));
  }

  if (user.isSuperAdmin || user.permissions.has("purchases.view")) {
    const s = await db()
      .select({ id: suppliers.id, name: suppliers.name, code: suppliers.code })
      .from(suppliers)
      .where(and(eq(suppliers.organizationId, user.organizationId), or(ilike(suppliers.name, pattern), ilike(suppliers.code, pattern))))
      .limit(limit);
    results.push(...s.map((r) => ({ type: "Supplier", label: r.name, sublabel: r.code, href: `/purchasing?supplier=${r.id}` })));
  }

  const priorityOrder: Record<string, number> = { Pasien: 0, Dokter: 1, "Rekam Medis": 2, Invoice: 3, Resep: 4, Obat: 5 };
  return results.sort((a, b) => (priorityOrder[a.type] ?? 9) - (priorityOrder[b.type] ?? 9)).slice(0, limit * 2);
}