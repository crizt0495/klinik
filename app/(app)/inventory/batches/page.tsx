import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listInventory } from "@/features/inventory/service";
import { InventoryView } from "@/features/inventory/inventory-view";

export const metadata: Metadata = { title: "Batch & Kadaluarsa" };

export default async function BatchesPage() {
  const user = await getSessionUser();
  assertCan(user, "inventory.view");
  const inventory = await listInventory(user);

  return (
    <div className="space-y-4">
      <PageHeader title="Batch & Kadaluarsa" description="Daftar batch obat beserta stok dan tanggal kedaluarsa." />
      <InventoryView items={inventory} />
    </div>
  );
}