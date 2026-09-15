import { pgTable, uuid, varchar, text, date, time, integer, index, boolean, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("departments_org_branch_code_idx").on(t.organizationId, t.branchId, t.code),
    index("departments_org_idx").on(t.organizationId),
    index("departments_branch_idx").on(t.branchId),
  ],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    departmentId: uuid("department_id").references(() => departments.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    roomType: varchar("room_type", { length: 64 }).notNull().default("EXAMINATION"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rooms_org_branch_code_idx").on(t.organizationId, t.branchId, t.code),
    index("rooms_org_idx").on(t.organizationId),
    index("rooms_branch_department_idx").on(t.branchId, t.departmentId),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    userId: uuid("user_id").references(() => users.id),
    employeeNumber: varchar("employee_number", { length: 32 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    staffType: varchar("staff_type", { length: 64 }).notNull().default("MEDICAL"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_org_emp_number_idx").on(t.organizationId, t.employeeNumber),
    index("staff_org_branch_idx").on(t.organizationId, t.branchId),
    index("staff_user_idx").on(t.userId),
  ],
);

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    staffId: uuid("staff_id").notNull().references(() => staff.id),
    licenseNumber: varchar("license_number", { length: 64 }),
    specialization: varchar("specialization", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("doctors_org_staff_idx").on(t.organizationId, t.staffId),
    index("doctors_org_branch_idx").on(t.organizationId, t.branchId),
  ],
);

export const doctorSchedules = pgTable(
  "doctor_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotDurationMinutes: integer("slot_duration_minutes").notNull().default(15),
    maxPatients: integer("max_patients").notNull().default(10),
    effectiveFrom: date("effective_from").notNull(),
    effectiveUntil: date("effective_until"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("doctor_schedules_doctor_idx").on(t.doctorId),
    index("doctor_schedules_org_branch_idx").on(t.organizationId, t.branchId),
    index("doctor_schedules_dept_idx").on(t.departmentId),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    medicalRecordNumber: varchar("medical_record_number", { length: 32 }).notNull(),
    nik: varchar("nik", { length: 32 }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    birthPlace: varchar("birth_place", { length: 128 }),
    birthDate: date("birth_date"),
    gender: varchar("gender", { length: 16 }).notNull(),
    bloodType: varchar("blood_type", { length: 8 }),
    maritalStatus: varchar("marital_status", { length: 16 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
    occupation: varchar("occupation", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("patients_org_mrn_idx").on(t.organizationId, t.medicalRecordNumber),
    index("patients_org_nik_idx").on(t.organizationId, t.nik),
    index("patients_org_name_idx").on(t.organizationId, t.fullName),
    index("patients_org_branch_idx").on(t.organizationId, t.branchId),
    index("patients_phone_idx").on(t.phone),
  ],
);

export const patientContacts = pgTable(
  "patient_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    relationship: varchar("relationship", { length: 64 }),
    phone: varchar("phone", { length: 32 }),
    address: text("address"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patient_contacts_patient_idx").on(t.patientId)],
);

export const insuranceProviders = pgTable(
  "insurance_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("insurance_providers_org_code_idx").on(t.organizationId, t.code),
    index("insurance_providers_org_idx").on(t.organizationId),
  ],
);

export const patientInsurances = pgTable(
  "patient_insurances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
    insuranceProviderId: uuid("insurance_provider_id").notNull().references(() => insuranceProviders.id),
    memberNumber: varchar("member_number", { length: 64 }).notNull(),
    policyNumber: varchar("policy_number", { length: 64 }),
    coverageClass: varchar("class", { length: 32 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("patient_insurances_patient_idx").on(t.patientId),
    index("patient_insurances_provider_idx").on(t.insuranceProviderId),
  ],
);