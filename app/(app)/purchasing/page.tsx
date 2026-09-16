import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPurchaseOrders, listSuppliers } from "@/features/inventory/service";
import { listMedications } from "@/features/appointments/service";
import { POView } from "@/features/inventory/po-view";
import { PurchaseOrderFormDialog } from "@/features/inventory/po-form-dialog";

export const metadata: Metadata = { title: "Pembelian" };

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const { supplier } = await searchParams;
  const user = await getSessionUser();
  assertCan(user, "purchases.view");
  const canCreate = user.isSuperAdmin || user.permissions.has("purchases.create");
  const [orders, suppliers, medications] = await Promise.all([
    listPurchaseOrders(user),
    canCreate ? listSuppliers(user) : Promise.resolve([]),
    canCreate ? listMedications(user) : Promise.resolve([]),
  ]);

  const filtered = supplier ? orders.filter((o) => o.supplierId === supplier) : orders;
  const supplierName = supplier ? suppliers.find((s) => s.id === supplier)?.name ?? null : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pembelian"
        description={supplierName ? `Purchase order dari ${supplierName}.` : "Daftar purchase order dan penerimaan barang."}
        actions={canCreate ? <PurchaseOrderFormDialog suppliers={suppliers} medications={medications} /> : null}
      />
      {supplierName ? (
        <p className="text-sm text-muted-foreground">
          Menampilkan PO untuk <span className="font-medium text-foreground">{supplierName}</span> —{" "}
          <Link href="/purchasing" className="text-primary hover:underline">tampilkan semua</Link>
        </p>
      ) : null}
      <POView orders={filtered} />
    </div>
  );
}