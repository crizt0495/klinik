import { pgTable, uuid, varchar, text, integer, index, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { patients, doctors } from "./clinical";
import { visits } from "./appointment";

export const medicalRecords = pgTable(
  "medical_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").references(() => doctors.id),
    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedBy: uuid("finalized_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("medical_records_visit_idx").on(t.visitId),
    index("medical_records_org_branch_idx").on(t.organizationId, t.branchId),
    index("medical_records_patient_idx").on(t.patientId),
    index("medical_records_status_idx").on(t.status),
  ],
);

export const medicalRecordVersions = pgTable(
  "medical_record_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    medicalRecordId: uuid("medical_record_id").notNull().references(() => medicalRecords.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),
    changedBy: uuid("changed_by").references(() => users.id),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mrv_mr_version_idx").on(t.medicalRecordId, t.versionNumber),
    index("medical_record_versions_mr_idx").on(t.medicalRecordId),
  ],
);

export const diagnoses = pgTable(
  "diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("diagnoses_org_code_idx").on(t.organizationId, t.code), index("diagnoses_org_idx").on(t.organizationId)],
);

export const medicalRecordDiagnoses = pgTable(
  "medical_record_diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    medicalRecordId: uuid("medical_record_id").notNull().references(() => medicalRecords.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id").notNull().references(() => diagnoses.id),
    diagnosisType: varchar("diagnosis_type", { length: 16 }).notNull().default("PRIMARY"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mrd_mr_diag_idx").on(t.medicalRecordId, t.diagnosisId, t.diagnosisType),
    index("medical_record_diagnoses_mr_idx").on(t.medicalRecordId),
    index("medical_record_diagnoses_diag_idx").on(t.diagnosisId),
  ],
);

export const procedures = pgTable(
  "procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    defaultPrice: varchar("default_price", { length: 32 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("procedures_org_code_idx").on(t.organizationId, t.code), index("procedures_org_idx").on(t.organizationId)],
);

export const medicalRecordProcedures = pgTable(
  "medical_record_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    medicalRecordId: uuid("medical_record_id").notNull().references(() => medicalRecords.id, { onDelete: "cascade" }),
    procedureId: uuid("procedure_id").notNull().references(() => procedures.id),
    quantity: integer("quantity").notNull().default(1),
    price: varchar("price", { length: 32 }).notNull(),
    notes: text("notes"),
    performedBy: uuid("performed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("medical_record_procedures_mr_idx").on(t.medicalRecordId),
    index("medical_record_procedures_proc_idx").on(t.procedureId),
  ],
);