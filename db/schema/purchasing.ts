import { pgTable, uuid, varchar, text, integer, index, uniqueIndex, timestamp, date } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { suppliers, medications } from "./pharmacy";

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    poNumber: varchar("po_number", { length: 32 }).notNull(),
    orderDate: date("order_date").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("purchase_orders_org_number_idx").on(t.organizationId, t.poNumber), index("purchase_orders_org_branch_idx").on(t.organizationId, t.branchId), index("purchase_orders_supplier_idx").on(t.supplierId)],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    quantity: integer("quantity").notNull(),
    unitPrice: varchar("unit_price", { length: 32 }).notNull(),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("purchase_order_items_po_idx").on(t.purchaseOrderId), index("purchase_order_items_med_idx").on(t.medicationId)],
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    supplierId: uuid("supplier_id").notNull().references(() => suppliers.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
    receiptNumber: varchar("receipt_number", { length: 32 }).notNull(),
    receiptDate: date("receipt_date").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    receivedBy: uuid("received_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("goods_receipts_org_number_idx").on(t.organizationId, t.receiptNumber), index("goods_receipts_org_branch_idx").on(t.organizationId, t.branchId), index("goods_receipts_po_idx").on(t.purchaseOrderId)],
);

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goodsReceiptId: uuid("goods_receipt_id").notNull().references(() => goodsReceipts.id, { onDelete: "cascade" }),
    medicationId: uuid("medication_id").notNull().references(() => medications.id),
    purchaseOrderItemId: uuid("purchase_order_item_id").references(() => purchaseOrderItems.id),
    batchNumber: varchar("batch_number", { length: 64 }).notNull(),
    expiryDate: date("expiry_date").notNull(),
    quantity: integer("quantity").notNull(),
    purchasePrice: varchar("purchase_price", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goods_receipt_items_gr_idx").on(t.goodsReceiptId), index("goods_receipt_items_med_idx").on(t.medicationId)],
);