import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listInventory } from "@/features/inventory/service";
import { StockOpnameForm } from "@/features/inventory/stock-opname-form";

export const metadata: Metadata = { title: "Stock Opname" };

export default async function StockOpnamePage() {
  const user = await getSessionUser();
  assertCan(user, "inventory.opname");
  const inventory = await listInventory(user);

  return (
    <div className="space-y-4">
      <PageHeader title="Stock Opname" description="Sesuaikan stok fisik dengan penghitungan ulang." />
      <StockOpnameForm inventory={inventory} />
    </div>
  );
}