import { hashPassword } from "../lib/auth/password";
import { ROLE_DEFINITIONS } from "../lib/permissions";
import { applyLocalMigrations, getDb, resolveDriver } from "../db";
import * as schema from "../db/schema";
import { and, eq } from "drizzle-orm";
import { join } from "path";

const PERMISSION_NAMES = new Set<string>();
for (const def of Object.values(ROLE_DEFINITIONS)) {
  for (const p of def.permissions) PERMISSION_NAMES.add(p);
}

export const DEMO_USERS: Record<string, { username: string; password: string; fullName: string }> = {
  owner: { username: "owner", password: "Owner@2026", fullName: "Pemilik Klinik" },
  admin: { username: "admin", password: "Admin@2026", fullName: "Admin Klinik" },
  doctor: { username: "doctor", password: "Doctor@2026", fullName: "dr. Andi Wijaya" },
  nurse: { username: "nurse", password: "Nurse@2026", fullName: "Siti Rahma, S.Kep" },
  receptionist: { username: "receptionist", password: "Receptionist@2026", fullName: "Dewi Lestari" },
  pharmacist: { username: "pharmacist", password: "Pharmacist@2026", fullName: "apt. Budi Santoso" },
  cashier: { username: "cashier", password: "Cashier@2026", fullName: "Rina Permata" },
  lab: { username: "lab", password: "Lab@2026", fullName: "Maya Kusuma, A.Md.AK" },
  radiology: { username: "radiology", password: "Radiology@2026", fullName: "Joko Susilo, A.Md.Rad" },
  manager: { username: "manager", password: "Manager@2026", fullName: "Hendra Gunawan" },
};

export async function isSeeded(): Promise<boolean> {
  const db = getDb();
  const rows = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
  return rows.length > 0;
}

/**
 * Idempotently syncs the permission catalog and grants new permissions to
 * existing roles based on ROLE_DEFINITIONS. Runs on every seed invocation so
 * newly added permissions/modules are provisioned even on already-seeded DBs.
 */
export async function syncPermissionCatalog(): Promise<void> {
  const db = getDb();
  const permIdMap = new Map<string, string>();
  const existingPerms = await db.select({ id: schema.permissions.id, code: schema.permissions.code }).from(schema.permissions);
  for (const p of existingPerms) permIdMap.set(p.code, p.id);

  const missingPerms = [...PERMISSION_NAMES].filter((p) => !permIdMap.has(p));
  if (missingPerms.length > 0) {
    const insPerms = await db.insert(schema.permissions).values(missingPerms.map((p) => ({ code: p, module: p.split(".")[0] ?? "general", name: p }))).returning({ id: schema.permissions.id, code: schema.permissions.code });
    for (const p of insPerms) permIdMap.set(p.code, p.id);
  }

  const roles = await db.select().from(schema.roles);
  for (const role of roles) {
    const def = ROLE_DEFINITIONS[role.code];
    if (!def) continue;
    for (const perm of def.permissions) {
      const permId = permIdMap.get(perm);
      if (!permId) continue;
      const exists = await db.select({ roleId: schema.rolePermissions.roleId }).from(schema.rolePermissions).where(and(eq(schema.rolePermissions.roleId, role.id), eq(schema.rolePermissions.permissionId, permId))).limit(1);
      if (exists.length === 0) {
        await db.insert(schema.rolePermissions).values({ roleId: role.id, permissionId: permId });
      }
    }
  }
}

export async function runSeed(): Promise<void> {
  const driver = resolveDriver();
  if (driver === "pglite") {
    await applyLocalMigrations(join(process.cwd(), "db", "migrations"));
  }
  const db = getDb();

  const seeded = await isSeeded();
  await syncPermissionCatalog();
  if (seeded) {
    return;
  }

  const org = await db.insert(schema.organizations).values({ code: "KLS", name: "Klinik Sehat", legalName: "PT Klinik Sehat Indonesia", phone: "021-5551234", email: "info@kliniksehat.id", address: "Jl. Merdeka No. 1, Jakarta", status: "ACTIVE" }).returning();
  const organizationId = org[0].id;

  const branchRows = await db
    .insert(schema.branches)
    .values([
      { organizationId, code: "PST", name: "Pusat", address: "Jl. Merdeka No. 1, Jakarta", status: "ACTIVE" },
      { organizationId, code: "CAB", name: "Cabang Permai", address: "Jl. Permai No. 10, Bogor", status: "ACTIVE" },
    ])
    .returning();
  const branchId = branchRows[0].id;

  const departments = await db
    .insert(schema.departments)
    .values([
      { organizationId, branchId, code: "UMUM", name: "Poli Umum", description: "Poli rawat jalan umum", status: "ACTIVE" },
      { organizationId, branchId, code: "GIGI", name: "Poli Gigi", description: "Poli kesehatan gigi dan mulut", status: "ACTIVE" },
      { organizationId, branchId, code: "ANAK", name: "Poli Anak", description: "Poli kesehatan anak", status: "ACTIVE" },
    ])
    .returning();
  const deptIds: Record<string, string> = {};
  for (const d of departments) deptIds[d.code] = d.id;

  await db.insert(schema.rooms).values([
    { organizationId, branchId, code: "R-01", name: "Ruang Periksa 1", roomType: "EXAMINATION", status: "ACTIVE" },
    { organizationId, branchId, code: "R-02", name: "Ruang Periksa 2", roomType: "EXAMINATION", status: "ACTIVE" },
    { organizationId, branchId, code: "T-01", name: "Tindakan 1", roomType: "TREATMENT", status: "ACTIVE" },
  ]);

  const roleIds = new Map<string, string>();
  const insertedRoles = await db.insert(schema.roles).values(Object.entries(ROLE_DEFINITIONS).map(([code, def]) => ({ organizationId, code, name: def.name, description: def.description, isSystem: true }))).returning();
  for (const r of insertedRoles) roleIds.set(r.code, r.id);

  const permIdMap = new Map<string, string>();
  const existingPerms = await db.select({ id: schema.permissions.id, code: schema.permissions.code }).from(schema.permissions);
  for (const p of existingPerms) permIdMap.set(p.code, p.id);

  const rpValues: { roleId: string; permissionId: string }[] = [];
  for (const [roleCode, def] of Object.entries(ROLE_DEFINITIONS)) {
    const roleId = roleIds.get(roleCode);
    if (!roleId) continue;
    for (const perm of def.permissions) {
      const permId = permIdMap.get(perm);
      if (permId) rpValues.push({ roleId, permissionId: permId });
    }
  }
  if (rpValues.length > 0) {
    await db.insert(schema.rolePermissions).values(rpValues).onConflictDoNothing();
  }

  const userMap: Record<string, string> = {};
  for (const [key, demo] of Object.entries(DEMO_USERS)) {
    const passwordHash = await hashPassword(demo.password);
    const inserted = await db.insert(schema.users).values({ organizationId, branchId, username: demo.username, passwordHash, fullName: demo.fullName, isActive: true, mustChangePassword: true }).returning();
    userMap[key] = inserted[0].id;
    const roleCode = key === "doctor" ? "DOKTER" : key === "nurse" ? "PERAWAT" : key === "receptionist" ? "RESEPSIONIS" : key === "pharmacist" ? "APOTEKER" : key === "cashier" ? "KASIR" : key === "lab" ? "PETUGAS_LAB" : key === "radiology" ? "PETUGAS_RADIOLOGI" : key === "manager" ? "MANAJER" : key === "owner" ? "OWNER" : "ADMIN_KLINIK";
    const roleId = roleIds.get(roleCode);
    if (roleId) {
      await db.insert(schema.userRoles).values({ userId: inserted[0].id, roleId, branchId }).onConflictDoNothing();
    }
    if (key === "owner") {
      const superAdminId = roleIds.get("SUPER_ADMIN");
      if (superAdminId) {
        await db.insert(schema.userRoles).values({ userId: inserted[0].id, roleId: superAdminId, branchId }).onConflictDoNothing();
      }
    }
  }

  const staffRows = await db
    .insert(schema.staff)
    .values([
      { organizationId, branchId, userId: userMap["doctor"], employeeNumber: "EMP-001", fullName: DEMO_USERS.doctor.fullName, staffType: "DOCTOR", status: "ACTIVE" },
      { organizationId, branchId, userId: userMap["nurse"], employeeNumber: "EMP-002", fullName: DEMO_USERS.nurse.fullName, staffType: "NURSE", status: "ACTIVE" },
      { organizationId, branchId, userId: userMap["lab"], employeeNumber: "EMP-003", fullName: DEMO_USERS.lab.fullName, staffType: "LAB", status: "ACTIVE" },
      { organizationId, branchId, userId: userMap["radiology"], employeeNumber: "EMP-004", fullName: DEMO_USERS.radiology.fullName, staffType: "RADIOLOGY", status: "ACTIVE" },
    ])
    .returning();
  const doctorStuffId = staffRows.find((s) => s.staffType === "DOCTOR")?.id;
  if (!doctorStuffId) throw new Error("Doctor staff not created");
  const doctor = await db.insert(schema.doctors).values([{ organizationId, branchId, staffId: doctorStuffId, licenseNumber: "STR-2026-0001", specialization: "Umum", status: "ACTIVE" }]).returning();
  const doctorId = doctor[0].id;

  for (const day of [1, 2, 3, 4, 5]) {
    await db.insert(schema.doctorSchedules).values({ organizationId, branchId, doctorId, departmentId: deptIds.UMUM, dayOfWeek: day, startTime: "08:00:00", endTime: "14:00:00", slotDurationMinutes: 15, maxPatients: 20, effectiveFrom: "2026-01-01", status: "ACTIVE" });
  }

  await db
    .insert(schema.patients)
    .values([
      { organizationId, branchId, medicalRecordNumber: "MR-2026-000001", nik: "3171010101950001", fullName: "Budi Hartono", birthDate: "1995-01-01", gender: "MALE", bloodType: "O", maritalStatus: "MARRIED", phone: "08123456701", address: "Jl. Melati No. 5", status: "ACTIVE" },
      { organizationId, branchId, medicalRecordNumber: "MR-2026-000002", nik: "3171020202960002", fullName: "Siti Aminah", birthDate: "1996-02-02", gender: "FEMALE", bloodType: "A", maritalStatus: "SINGLE", phone: "08123456702", address: "Jl. Mawar No. 3", status: "ACTIVE" },
      { organizationId, branchId, medicalRecordNumber: "MR-2026-000003", nik: "3171030303970003", fullName: "Ahmad Fauzi", birthDate: "1997-03-03", gender: "MALE", phone: "08123456703", address: "Jl. Kenanga No. 7", status: "ACTIVE" },
      { organizationId, branchId, medicalRecordNumber: "MR-2026-000004", nik: "3171040404980004", fullName: "Ratna Dewi", birthDate: "1998-04-04", gender: "FEMALE", phone: "08123456704", status: "ACTIVE" },
    ]);

  await db.insert(schema.counters).values({ organizationId, branchId, scope: "MRN", period: String(new Date().getFullYear()), sequence: 4 }).onConflictDoNothing();

  const categories = await db.insert(schema.medicationCategories).values([{ organizationId, name: "Analgesik", status: "ACTIVE" }, { organizationId, name: "Antibiotik", status: "ACTIVE" }, { organizationId, name: "Vitamin", status: "ACTIVE" }]).returning();

  const meds = await db
    .insert(schema.medications)
    .values([
      { organizationId, categoryId: categories[0].id, code: "OBT-001", name: "Parasetamol 500mg", genericName: "Paracetamol", dosageForm: "Tablet", strength: "500mg", unit: "strip", sellingPrice: "5000", purchasePrice: "3000", minimumStock: 20, status: "ACTIVE" },
      { organizationId, categoryId: categories[0].id, code: "OBT-002", name: "Ibuprofen 400mg", genericName: "Ibuprofen", dosageForm: "Tablet", strength: "400mg", unit: "strip", sellingPrice: "8000", purchasePrice: "5000", minimumStock: 15, status: "ACTIVE" },
      { organizationId, categoryId: categories[1].id, code: "OBT-003", name: "Amoksisilin 500mg", genericName: "Amoxicillin", dosageForm: "Kapsul", strength: "500mg", unit: "strip", sellingPrice: "12000", purchasePrice: "7000", minimumStock: 10, status: "ACTIVE" },
      { organizationId, categoryId: categories[2].id, code: "OBT-004", name: "Vitamin C 500mg", genericName: "Ascorbic Acid", dosageForm: "Tablet", strength: "500mg", unit: "botol", sellingPrice: "15000", purchasePrice: "9000", minimumStock: 5, status: "ACTIVE" },
    ])
    .returning();
  const medIds = meds.map((m) => m.id);

  await db.insert(schema.inventoryBatches).values([
    { organizationId, branchId, medicationId: medIds[0], batchNumber: "B20260101", expiryDate: "2027-01-01", quantityReceived: 100, quantityAvailable: 100, purchasePrice: "3000", sellingPrice: "5000", status: "ACTIVE" },
    { organizationId, branchId, medicationId: medIds[0], batchNumber: "B20260201", expiryDate: "2026-12-01", quantityReceived: 50, quantityAvailable: 50, purchasePrice: "3000", sellingPrice: "5000", status: "ACTIVE" },
    { organizationId, branchId, medicationId: medIds[1], batchNumber: "B20260102", expiryDate: "2027-06-01", quantityReceived: 60, quantityAvailable: 60, purchasePrice: "5000", sellingPrice: "8000", status: "ACTIVE" },
    { organizationId, branchId, medicationId: medIds[2], batchNumber: "B20260103", expiryDate: "2026-10-01", quantityReceived: 80, quantityAvailable: 80, purchasePrice: "7000", sellingPrice: "12000", status: "ACTIVE" },
  ]);

  await db.insert(schema.suppliers).values([{ organizationId, code: "SUP-001", name: "PT Pharma Jaya", phone: "021-777888", status: "ACTIVE" }, { organizationId, code: "SUP-002", name: "CV Obat Sehat", phone: "021-999000", status: "ACTIVE" }]);

  await db.insert(schema.serviceCategories).values([{ organizationId, name: "Konsultasi", status: "ACTIVE" }, { organizationId, name: "Pemeriksaan", status: "ACTIVE" }]);

  await db.insert(schema.services).values([
    { organizationId, code: "SVC-001", name: "Konsultasi Dokter Umum", price: "100000", status: "ACTIVE" },
    { organizationId, code: "SVC-002", name: "Konsultasi Dokter Gigi", price: "150000", status: "ACTIVE" },
    { organizationId, code: "SVC-003", name: "Cek Darah Rutin", price: "75000", status: "ACTIVE" },
  ]);

  await db.insert(schema.procedures).values([
    { organizationId, code: "TI-001", name: "Jahit Luka", defaultPrice: "150000", status: "ACTIVE" },
    { organizationId, code: "TI-002", name: "Injeksi", defaultPrice: "20000", status: "ACTIVE" },
  ]);

  await db.insert(schema.diagnoses).values([
    { organizationId, code: "J06.9", name: "Infeksi Saluran Pernapasan Akut (ISPA)", status: "ACTIVE" },
    { organizationId, code: "K29.7", name: "Gastritis", status: "ACTIVE" },
    { organizationId, code: "M54.5", name: "Low Back Pain", status: "ACTIVE" },
    { organizationId, code: "E78.5", name: "Hiperlipidemia", status: "ACTIVE" },
  ]);

  await db.insert(schema.insuranceProviders).values([{ organizationId, code: "BPJS", name: "BPJS Kesehatan", phone: "1500400", status: "ACTIVE" }, { organizationId, code: "PRI", name: "Asuransi Prima", status: "ACTIVE" }]);

  await db
    .insert(schema.bpjsSettings)
    .values({ organizationId: org[0].id, enabled: false, mockMode: true, faskesName: "Klinik Sehat" })
    .onConflictDoNothing();
}

export async function bootstrapSeed(): Promise<void> {
  if (!(await isSeeded())) {
    await runSeed();
  }
}