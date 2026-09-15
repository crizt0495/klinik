import { pgTable, uuid, varchar, text, integer, index, uniqueIndex, timestamp, date, boolean as boolean_col } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { patients, doctors } from "./clinical";
import { visits } from "./appointment";

export const medicationCategories = pgTable(
  "medication_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("medication_categories_org_idx").on(t.organizationId)],
);

export const medications = pgTable(
  "medications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    categoryId: uuid("category_id").references(() => medicationCategories.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    genericName: varchar("generic_name", { length: 255 }),
    dosageForm: varchar("dosage_form", { length: 64 }),
    strength: varchar("strength", { length: 64 }),
    unit: varchar("unit", { length: 32 }).notNull().default("unit"),
    sellingPrice: varchar("selling_price", { length: 32 }).notNull().default("0"),
    purchasePrice: varchar("purchase_price", { length: 32 }).notNull().default("0"),
    minimumStock: integer("minimum_stock").notNull().default(0),
    requiresBatch: boolean_col("requires_batch").default(true).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("medications_org_code_idx").on(t.organizationId, t.code),
    index("medications_org_idx").on(t.organizationId),
    index("medications_category_idx").on(t.categoryId),
  ],
);

export const suppliers = pgTable(
  "suppliers",
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
    uniqueIndex("suppliers_org_code_idx").on(t.organizationId, t.code),
    index("suppliers_org_idx").on(t.organizationId),
  ],
);

export const inventoryBatches = pgTable(
  "inventory_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    batchNumber: varchar("batch_number", { length: 64 }).notNull(),
    expiryDate: date("expiry_date").notNull(),
    quantityReceived: integer("quantity_received").notNull().default(0),
    quantityAvailable: integer("quantity_available").notNull().default(0),
    purchasePrice: varchar("purchase_price", { length: 32 }).notNull().default("0"),
    sellingPrice: varchar("selling_price", { length: 32 }).notNull().default("0"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("inventory_batches_org_branch_med_batch_idx").on(t.organizationId, t.branchId, t.medicationId, t.batchNumber),
    index("inventory_batches_expiry_idx").on(t.expiryDate),
    index("inventory_batches_med_idx").on(t.medicationId),
    index("inventory_batches_org_branch_idx").on(t.organizationId, t.branchId),
    index("inventory_batches_available_idx").on(t.quantityAvailable),
  ],
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    batchId: uuid("batch_id").references(() => inventoryBatches.id),
    transactionType: varchar("transaction_type", { length: 32 }).notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: varchar("reference_type", { length: 64 }),
    referenceId: uuid("reference_id"),
    reason: text("reason"),
    performedBy: uuid("performed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_transactions_org_branch_idx").on(t.organizationId, t.branchId),
    index("inventory_transactions_med_idx").on(t.medicationId),
    index("inventory_transactions_batch_idx").on(t.batchId),
    index("inventory_transactions_type_created_idx").on(t.transactionType, t.createdAt),
    index("inventory_transactions_ref_idx").on(t.referenceType, t.referenceId),
  ],
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    prescriptionNumber: varchar("prescription_number", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    notes: text("notes"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("prescriptions_org_number_idx").on(t.organizationId, t.prescriptionNumber),
    index("prescriptions_visit_idx").on(t.visitId),
    index("prescriptions_patient_idx").on(t.patientId),
    index("prescriptions_status_idx").on(t.status),
    index("prescriptions_org_branch_idx").on(t.organizationId, t.branchId),
  ],
);

export const prescriptionItems = pgTable(
  "prescription_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prescriptionId: uuid("prescription_id").notNull().references(() => prescriptions.id, { onDelete: "cascade" }),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    quantity: integer("quantity").notNull(),
    dosage: varchar("dosage", { length: 64 }),
    frequency: varchar("frequency", { length: 64 }),
    route: varchar("route", { length: 64 }).notNull().default("ORAL"),
    duration: varchar("duration", { length: 64 }),
    instructions: text("instructions"),
    dispensedQuantity: integer("dispensed_quantity").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prescription_items_prescription_idx").on(t.prescriptionId),
    index("prescription_items_medication_idx").on(t.medicationId),
  ],
);

export const prescriptionBatchAllocations = pgTable(
  "prescription_batch_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prescriptionItemId: uuid("prescription_item_id").notNull().references(() => prescriptionItems.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").notNull().references(() => inventoryBatches.id),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("prescription_batch_allocations_item_idx").on(t.prescriptionItemId),
    index("prescription_batch_allocations_batch_idx").on(t.batchId),
  ],
);

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    opnameNumber: varchar("opname_number", { length: 32 }).notNull(),
    opnameDate: date("opname_date").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stock_opnames_org_number_idx").on(t.organizationId, t.opnameNumber), index("stock_opnames_org_branch_idx").on(t.organizationId, t.branchId)],
);

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stockOpnameId: uuid("stock_opname_id").notNull().references(() => stockOpnames.id, { onDelete: "cascade" }),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    batchId: uuid("batch_id").references(() => inventoryBatches.id),
    systemQuantity: integer("system_quantity").notNull().default(0),
    physicalQuantity: integer("physical_quantity").notNull().default(0),
    difference: integer("difference").notNull().default(0),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_opname_items_opname_idx").on(t.stockOpnameId), index("stock_opname_items_med_idx").on(t.medicationId)],
);