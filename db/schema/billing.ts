import { pgTable, uuid, varchar, text, integer, index, uniqueIndex, timestamp, date, bigint as bigint_col } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { patients } from "./clinical";
import { visits, appointments } from "./appointment";

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_categories_org_idx").on(t.organizationId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    categoryId: uuid("category_id").references(() => serviceCategories.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: varchar("price", { length: 32 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("services_org_code_idx").on(t.organizationId, t.code), index("services_org_idx").on(t.organizationId), index("services_category_idx").on(t.categoryId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    visitId: uuid("visit_id").references(() => visits.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    invoiceNumber: varchar("invoice_number", { length: 32 }).notNull(),
    invoiceDate: date("invoice_date").notNull(),
    subtotal: varchar("subtotal", { length: 32 }).notNull().default("0"),
    discount: varchar("discount", { length: 32 }).notNull().default("0"),
    tax: varchar("tax", { length: 32 }).notNull().default("0"),
    total: varchar("total", { length: 32 }).notNull().default("0"),
    paidAmount: varchar("paid_amount", { length: 32 }).notNull().default("0"),
    dueAmount: varchar("due_amount", { length: 32 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_org_number_idx").on(t.organizationId, t.invoiceNumber),
    index("invoices_patient_idx").on(t.patientId),
    index("invoices_visit_idx").on(t.visitId),
    index("invoices_org_branch_date_idx").on(t.organizationId, t.branchId, t.invoiceDate),
    index("invoices_status_idx").on(t.status),
    index("invoices_due_idx").on(t.dueAmount),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    itemType: varchar("item_type", { length: 32 }).notNull(),
    referenceId: uuid("reference_id"),
    description: varchar("description", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: varchar("unit_price", { length: 32 }).notNull(),
    discount: varchar("discount", { length: 32 }).notNull().default("0"),
    subtotal: varchar("subtotal", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId), index("invoice_items_reference_idx").on(t.referenceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    paymentNumber: varchar("payment_number", { length: 32 }).notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
    amount: varchar("amount", { length: 32 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(),
    referenceNumber: varchar("reference_number", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull().default("COMPLETED"),
    receivedBy: uuid("received_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payments_org_number_idx").on(t.organizationId, t.paymentNumber), index("payments_invoice_idx").on(t.invoiceId), index("payments_org_branch_date_idx").on(t.organizationId, t.branchId, t.paymentDate), index("payments_status_idx").on(t.status)],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    amount: varchar("amount", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_allocations_payment_idx").on(t.paymentId), index("payment_allocations_invoice_idx").on(t.invoiceId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    refundNumber: varchar("refund_number", { length: 32 }).notNull(),
    amount: varchar("amount", { length: 32 }).notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("REQUESTED"),
    requestedBy: uuid("requested_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    processedBy: uuid("processed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("refunds_org_number_idx").on(t.organizationId, t.refundNumber), index("refunds_payment_idx").on(t.paymentId), index("refunds_invoice_idx").on(t.invoiceId), index("refunds_org_branch_idx").on(t.organizationId, t.branchId)],
);

export const patientDocuments = pgTable(
  "patient_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSize: bigint_col("file_size", { mode: "number" }).notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patient_documents_patient_idx").on(t.patientId), index("patient_documents_org_branch_idx").on(t.organizationId, t.branchId)],
);