import { pgTable, uuid, varchar, text, index, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { patients, doctors } from "./clinical";
import { visits } from "./appointment";

export const laboratoryOrders = pgTable(
  "laboratory_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").references(() => doctors.id),
    orderNumber: varchar("order_number", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("ORDERED"),
    priority: varchar("priority", { length: 16 }).notNull().default("ROUTINE"),
    clinicalNote: text("clinical_note"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("laboratory_orders_org_number_idx").on(t.organizationId, t.orderNumber), index("laboratory_orders_org_branch_idx").on(t.organizationId, t.branchId), index("laboratory_orders_visit_idx").on(t.visitId), index("laboratory_orders_status_idx").on(t.status)],
);

export const laboratoryOrderItems = pgTable(
  "laboratory_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    laboratoryOrderId: uuid("laboratory_order_id").notNull().references(() => laboratoryOrders.id, { onDelete: "cascade" }),
    testCode: varchar("test_code", { length: 64 }).notNull(),
    testName: varchar("test_name", { length: 255 }).notNull(),
    referenceRange: text("reference_range"),
    resultValue: text("result_value"),
    unit: varchar("unit", { length: 32 }),
    resultFlag: varchar("result_flag", { length: 16 }),
    notes: text("notes"),
    status: varchar("status", { length: 32 }).notNull().default("ORDERED"),
    processedBy: uuid("processed_by").references(() => users.id),
    verifiedBy: uuid("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("laboratory_order_items_order_idx").on(t.laboratoryOrderId), index("laboratory_order_items_status_idx").on(t.status)],
);

export const radiologyOrders = pgTable(
  "radiology_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").references(() => doctors.id),
    orderNumber: varchar("order_number", { length: 32 }).notNull(),
    procedureName: varchar("procedure_name", { length: 255 }).notNull(),
    clinicalInformation: text("clinical_information"),
    status: varchar("status", { length: 32 }).notNull().default("ORDERED"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("radiology_orders_org_number_idx").on(t.organizationId, t.orderNumber), index("radiology_orders_org_branch_idx").on(t.organizationId, t.branchId), index("radiology_orders_visit_idx").on(t.visitId), index("radiology_orders_status_idx").on(t.status)],
);

export const radiologyResults = pgTable(
  "radiology_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    radiologyOrderId: uuid("radiology_order_id").notNull().references(() => radiologyOrders.id, { onDelete: "cascade" }),
    findings: text("findings"),
    impression: text("impression"),
    reportText: text("report_text"),
    reportedBy: uuid("reported_by").references(() => users.id),
    verifiedBy: uuid("verified_by").references(() => users.id),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("radiology_results_order_idx").on(t.radiologyOrderId)],
);