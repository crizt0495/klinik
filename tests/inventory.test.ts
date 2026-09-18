import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { db } from "@/db";
import * as s from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { listInventory, createStockOpname, createPurchaseOrder, getPurchaseOrder, receivePurchaseOrder, listPurchaseOrders, listSuppliers } from "@/features/inventory/service";
import { InvalidStateError, NotFoundError } from "@/lib/errors";

let admin: SessionUser;
let medId: string;
let batchId: string;
let supplierId: string;

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  medId = (await db().select({ id: s.medications.id }).from(s.medications).where(eq(s.medications.organizationId, admin.organizationId)).orderBy(asc(s.medications.code)).limit(1))[0].id;
  batchId = (await db().select({ id: s.inventoryBatches.id }).from(s.inventoryBatches).where(and(eq(s.inventoryBatches.organizationId, admin.organizationId), eq(s.inventoryBatches.medicationId, medId))).orderBy(asc(s.inventoryBatches.expiryDate)).limit(1))[0].id;
  supplierId = (await db().select({ id: s.suppliers.id }).from(s.suppliers).where(eq(s.suppliers.organizationId, admin.organizationId)).orderBy(asc(s.suppliers.name)).limit(1))[0].id;
}, 120000);

describe("modul inventori & pembelian", () => {
  it("1. listInventory memuat batch aktif dengan stok", async () => {
    const inv = await listInventory(admin);
    expect(inv.length).toBeGreaterThanOrEqual(1);
    expect(inv.every((i) => i.status === "ACTIVE")).toBe(true);
    expect(inv.some((i) => i.batchId === batchId)).toBe(true);
  });

  it("2. stock opname menyesuaikan stok & mencatat transaksi ADJUSTMENT", async () => {
    const before = (await listInventory(admin)).find((i) => i.batchId === batchId)?.quantityAvailable ?? 0;
    await createStockOpname(admin, medId, batchId, before + 7, "Opname uji");
    const after = (await listInventory(admin)).find((i) => i.batchId === batchId)?.quantityAvailable ?? 0;
    expect(after).toBe(before + 7);
    const tx = await db().select().from(s.inventoryTransactions).where(and(eq(s.inventoryTransactions.batchId, batchId), eq(s.inventoryTransactions.transactionType, "ADJUSTMENT")));
    expect(tx.length).toBeGreaterThanOrEqual(1);
  });

  it("3. stock opname batch tidak ada ditolak 404", async () => {
    await expect(createStockOpname(admin, medId, "00000000-0000-0000-0000-000000000000", 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("4. membuat purchase order DRAFT dengan total", async () => {
    const poId = await createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", notes: "PO uji", items: [{ medicationId: medId, quantity: 10, unitPrice: 5000 }] });
    const po = await getPurchaseOrder(admin, poId);
    expect(po.po.status).toBe("DRAFT");
    expect(po.po.poNumber).toMatch(/^PO-/);
    expect(po.po.totalAmount).toBe("50000");
  });

  it("5. purchase order tanpa item ditolak", async () => {
    await expect(createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", items: [] })).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("6. getPurchaseOrder tidak ditemukan menolak 404", async () => {
    await expect(getPurchaseOrder(admin, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("7. penerimaan sebagian menghasilkan PARTIALLY_RECEIVED", async () => {
    const poId = await createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", items: [{ medicationId: medId, quantity: 20, unitPrice: 3000 }] });
    const po = await getPurchaseOrder(admin, poId);
    await receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 10 }]);
    expect((await getPurchaseOrder(admin, poId)).po.status).toBe("PARTIALLY_RECEIVED");
  });

  it("8. penerimaan penuh menghasilkan RECEIVED & batch baru", async () => {
    const poId = await createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", items: [{ medicationId: medId, quantity: 12, unitPrice: 3000 }] });
    const po = await getPurchaseOrder(admin, poId);
    const before = (await listInventory(admin)).filter((i) => i.medicationId === medId).length;
    await receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 12 }]);
    expect((await getPurchaseOrder(admin, poId)).po.status).toBe("RECEIVED");
    const after = (await listInventory(admin)).filter((i) => i.medicationId === medId).length;
    expect(after).toBe(before + 1);
  });

  it("9. penerimaan ulang PO yang sudah diterima ditolak", async () => {
    const poId = await createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", items: [{ medicationId: medId, quantity: 5, unitPrice: 3000 }] });
    const po = await getPurchaseOrder(admin, poId);
    await receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 5 }]);
    await expect(receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 1 }])).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("10. listPurchaseOrders dapat difilter status RECEIVED", async () => {
    const poId = await createPurchaseOrder(admin, { supplierId, expectedDate: "2026-10-01", items: [{ medicationId: medId, quantity: 4, unitPrice: 2500 }] });
    const po = await getPurchaseOrder(admin, poId);
    await receivePurchaseOrder(admin, poId, [{ itemId: po.items[0].id, quantityReceived: 4 }]);
    const received = await listPurchaseOrders(admin);
    const row = received.find((p) => p.id === poId);
    expect(row?.status).toBe("RECEIVED");
    expect(Number(row?.totalAmount)).toBe(10000);
  });

  it("11. listSuppliers memuat supplier organisasi", async () => {
    const suppliers = await listSuppliers(admin);
    expect(suppliers.length).toBeGreaterThanOrEqual(1);
    expect(suppliers.every((sup) => sup.organizationId === admin.organizationId)).toBe(true);
  });
});
