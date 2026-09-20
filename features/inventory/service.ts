import { and, eq, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { runInTransaction } from "@/db/transaction";
import * as s from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { NotFoundError, InvalidStateError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/services/audit";

export async function listInventory(user: SessionUser) {
  return db()
    .select({
      batchId: s.inventoryBatches.id,
      batchNumber: s.inventoryBatches.batchNumber,
      expiryDate: s.inventoryBatches.expiryDate,
      quantityAvailable: s.inventoryBatches.quantityAvailable,
      quantityReceived: s.inventoryBatches.quantityReceived,
      purchasePrice: s.inventoryBatches.purchasePrice,
      medicationId: s.medications.id,
      medicationCode: s.medications.code,
      medicationName: s.medications.name,
      unit: s.medications.unit,
      category: s.medicationCategories.name,
      status: s.inventoryBatches.status,
    })
    .from(s.inventoryBatches)
    .innerJoin(s.medications, eq(s.medications.id, s.inventoryBatches.medicationId))
    .leftJoin(s.medicationCategories, eq(s.medicationCategories.id, s.medications.categoryId))
    .where(and(eq(s.inventoryBatches.organizationId, user.organizationId), eq(s.inventoryBatches.branchId, user.branchId ?? ""), eq(s.inventoryBatches.status, "ACTIVE")))
    .orderBy(asc(s.medications.name), asc(s.inventoryBatches.expiryDate));
}

export async function createStockOpname(user: SessionUser, medicationId: string, batchId: string, countedQuantity: number, notes?: string) {
  const result = await runInTransaction(async (tx) => {
    const batch = await tx.select().from(s.inventoryBatches).where(and(eq(s.inventoryBatches.id, batchId), eq(s.inventoryBatches.organizationId, user.organizationId))).for("update").limit(1);
    const b = batch[0];
    if (!b) throw new NotFoundError("Batch inventory tidak ditemukan");
    const diff = countedQuantity - b.quantityAvailable;
    if (diff !== 0) {
      await tx.update(s.inventoryBatches).set({ quantityAvailable: countedQuantity, updatedAt: new Date() }).where(eq(s.inventoryBatches.id, batchId));
      await tx.insert(s.inventoryTransactions).values({
        organizationId: user.organizationId, branchId: user.branchId ?? "", medicationId, batchId, transactionType: "ADJUSTMENT", quantity: diff, referenceType: "stock_opname", referenceId: null, reason: notes ?? `Stock opname: ${b.quantityAvailable} → ${countedQuantity}`, performedBy: user.id,
      });
      return { adjusted: true, oldQuantity: b.quantityAvailable };
    }
    return { adjusted: false, oldQuantity: b.quantityAvailable };
  });
  await writeAuditLog({ user, action: "STOCK_ADJUSTMENT", entityType: "inventory_batches", entityId: batchId, oldData: { quantityAvailable: result.oldQuantity }, newData: { quantityAvailable: countedQuantity } });
}

export async function listPurchaseOrders(user: SessionUser) {
  return db()
    .select({
      id: s.purchaseOrders.id,
      number: s.purchaseOrders.poNumber,
      status: s.purchaseOrders.status,
      supplierId: s.purchaseOrders.supplierId,
      supplierName: s.suppliers.name,
      totalAmount: sql<string>`coalesce((select sum(cast(${s.purchaseOrderItems.unitPrice} as numeric) * ${s.purchaseOrderItems.quantity}) from ${s.purchaseOrderItems} where ${s.purchaseOrderItems.purchaseOrderId} = ${s.purchaseOrders.id}), 0)::text`,
      expectedDate: s.purchaseOrders.orderDate,
      createdAt: s.purchaseOrders.createdAt,
    })
    .from(s.purchaseOrders)
    .innerJoin(s.suppliers, eq(s.suppliers.id, s.purchaseOrders.supplierId))
    .where(eq(s.purchaseOrders.organizationId, user.organizationId))
    .orderBy(desc(s.purchaseOrders.createdAt));
}

export async function getPurchaseOrder(user: SessionUser, id: string) {
  const rows = await db().select().from(s.purchaseOrders).where(and(eq(s.purchaseOrders.id, id), eq(s.purchaseOrders.organizationId, user.organizationId))).limit(1);
  const po = rows[0];
  if (!po) throw new NotFoundError("Purchase order tidak ditemukan");
  const items = await db().select({
    id: s.purchaseOrderItems.id,
    medicationId: s.purchaseOrderItems.medicationId,
    medicationName: s.medications.name,
    unit: s.medications.unit,
    quantity: s.purchaseOrderItems.quantity,
    unitPrice: s.purchaseOrderItems.unitPrice,
    receivedQuantity: s.purchaseOrderItems.receivedQuantity,
  }).from(s.purchaseOrderItems).innerJoin(s.medications, eq(s.medications.id, s.purchaseOrderItems.medicationId)).where(eq(s.purchaseOrderItems.purchaseOrderId, id));
  const itemsWithSubtotal = items.map((i) => ({ ...i, subtotal: String(Number(i.unitPrice) * i.quantity) }));
  const totalAmount = String(itemsWithSubtotal.reduce((acc, i) => acc + Number(i.subtotal), 0));
  const supplier = await db().select({ name: s.suppliers.name }).from(s.suppliers).where(eq(s.suppliers.id, po.supplierId)).limit(1);
  return { po: { ...po, totalAmount, expectedDate: po.orderDate }, items: itemsWithSubtotal, supplierName: supplier[0]?.name ?? "" };
}

export async function createPurchaseOrder(user: SessionUser, data: { supplierId: string; expectedDate: string; notes?: string; items: Array<{ medicationId: string; quantity: number; unitPrice: number }> }) {
  if (!data.items || data.items.length === 0) throw new InvalidStateError("Minimal 1 item");
  const number = `PO-${Date.now()}`;
  let totalAmount = "0";
  for (const i of data.items) totalAmount = String(Number(totalAmount) + Number(i.unitPrice) * i.quantity);

  const result = await db().insert(s.purchaseOrders).values({
    organizationId: user.organizationId, branchId: user.branchId ?? "", supplierId: data.supplierId, poNumber: number, status: "DRAFT", orderDate: data.expectedDate, notes: data.notes, createdBy: user.id,
  }).returning({ id: s.purchaseOrders.id });

  const orderId = result[0].id;
  for (const item of data.items) {
    await db().insert(s.purchaseOrderItems).values({ purchaseOrderId: orderId, medicationId: item.medicationId, quantity: item.quantity, unitPrice: String(item.unitPrice), receivedQuantity: 0 });
  }

  await writeAuditLog({ user, action: "CREATE", entityType: "purchase_orders", entityId: orderId, newData: { number, totalAmount, itemCount: data.items.length } });
  return orderId;
}

export async function receivePurchaseOrder(user: SessionUser, purchaseOrderId: string, received: Array<{ itemId: string; quantityReceived: number }>) {
  const receivedItems = received.filter((r) => r.quantityReceived > 0);

  await runInTransaction(async (tx) => {
    // Kunci baris PO sehingga penerimaan paralel terserialisasi
    // dan tidak menghasilkan stok/batch yang dobel.
    const poRows = await tx.select().from(s.purchaseOrders).where(and(eq(s.purchaseOrders.id, purchaseOrderId), eq(s.purchaseOrders.organizationId, user.organizationId))).for("update").limit(1);
    const po = poRows[0];
    if (!po) throw new NotFoundError("PO tidak ditemukan");
    if (po.status === "RECEIVED") throw new InvalidStateError("PO sudah diterima");
    if (po.status === "CANCELLED") throw new InvalidStateError("PO sudah dibatalkan");

    for (const r of receivedItems) {
      const itemRows = await tx.select().from(s.purchaseOrderItems).where(eq(s.purchaseOrderItems.id, r.itemId)).for("update").limit(1);
      const item = itemRows[0];
      if (!item) throw new NotFoundError(`Item ${r.itemId} tidak ditemukan`);
      if (item.purchaseOrderId !== purchaseOrderId) throw new InvalidStateError("Item tidak termasuk dalam PO ini");

      await tx.update(s.purchaseOrderItems).set({ receivedQuantity: sql`${s.purchaseOrderItems.receivedQuantity} + ${r.quantityReceived}`, updatedAt: new Date() }).where(eq(s.purchaseOrderItems.id, r.itemId));

      // Create batch (default expiry 1 year from now)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const batchNumber = `BAT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const [newBatch] = await tx.insert(s.inventoryBatches).values({
        organizationId: user.organizationId, branchId: user.branchId ?? "", medicationId: item.medicationId, batchNumber, expiryDate: expiryDate.toISOString().slice(0, 10), quantityReceived: r.quantityReceived, quantityAvailable: r.quantityReceived, purchasePrice: item.unitPrice, receivedAt: new Date(), status: "ACTIVE",
      }).returning({ id: s.inventoryBatches.id });

      await tx.insert(s.inventoryTransactions).values({
        organizationId: user.organizationId, branchId: user.branchId ?? "", medicationId: item.medicationId, batchId: newBatch.id, transactionType: "RECEIPT", quantity: r.quantityReceived, referenceType: "purchase_orders", referenceId: purchaseOrderId, reason: `Penerimaan PO ${po.poNumber}`, performedBy: user.id,
      });
    }

    // Check if all items fully received
    const allItems = await tx.select().from(s.purchaseOrderItems).where(eq(s.purchaseOrderItems.purchaseOrderId, purchaseOrderId));
    const allReceived = allItems.every((i) => i.receivedQuantity >= i.quantity);
    if (allReceived) {
      await tx.update(s.purchaseOrders).set({ status: "RECEIVED", updatedAt: new Date() }).where(eq(s.purchaseOrders.id, purchaseOrderId));
    } else {
      await tx.update(s.purchaseOrders).set({ status: "PARTIALLY_RECEIVED", updatedAt: new Date() }).where(eq(s.purchaseOrders.id, purchaseOrderId));
    }
  });

  await writeAuditLog({ user, action: "RECEIVE_PO", entityType: "purchase_orders", entityId: purchaseOrderId, newData: { receivedItems: receivedItems.length } });
}

export async function listSuppliers(user: SessionUser) {
  return db().select().from(s.suppliers).where(eq(s.suppliers.organizationId, user.organizationId)).orderBy(asc(s.suppliers.name));
}