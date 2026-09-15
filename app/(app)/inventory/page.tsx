import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listInventory, listPurchaseOrders, listSuppliers } from "@/features/inventory/service";
import { listMedications } from "@/features/appointments/service";
import { InventoryView } from "@/features/inventory/inventory-view";
import { POView } from "@/features/inventory/po-view";
import { PurchaseOrderFormDialog } from "@/features/inventory/po-form-dialog";
import { StockOpnameForm } from "@/features/inventory/stock-opname-form";

export const metadata: Metadata = { title: "Inventori" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  const canManage = user.isSuperAdmin || user.permissions.has("inventory.manage");
  const canPurchase = user.isSuperAdmin || user.permissions.has("purchasing.create");
  const inventory = await listInventory(user);
  const poList = canPurchase ? await listPurchaseOrders(user) : [];
  let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
  let medications: Awaited<ReturnType<typeof listMedications>> = [];
  if (canPurchase) {
    [suppliers, medications] = await Promise.all([listSuppliers(user), listMedications(user)]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventori"
        description="Stok obat, stock opname, dan purchase order."
        actions={
          <div className="flex gap-2">
            {canPurchase ? <PurchaseOrderFormDialog suppliers={suppliers} medications={medications} /> : null}
          </div>
        }
      />
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stok</TabsTrigger>
          {canManage ? <TabsTrigger value="opname">Stock Opname</TabsTrigger> : null}
          {canPurchase ? <TabsTrigger value="po">Purchase Orders</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="stock"><InventoryView items={inventory} /></TabsContent>
        {canManage && <TabsContent value="opname"><StockOpnameForm inventory={inventory} /></TabsContent>}
        {canPurchase && <TabsContent value="po"><POView orders={poList} /></TabsContent>}
      </Tabs>
    </div>
  );
}