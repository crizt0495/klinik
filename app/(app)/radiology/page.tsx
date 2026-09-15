import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listRadiologyOrders } from "@/features/labs/service";
import { RadiologyOrdersView } from "@/features/labs/radiology-orders-view";

export const metadata: Metadata = { title: "Radiologi" };

export default async function RadiologyPage() {
  const user = await getSessionUser();
  assertCan(user, "radiology.view");
  const orders = await listRadiologyOrders(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Radiologi" description="Daftar order dan hasil radiologi." />
      <RadiologyOrdersView orders={orders} />
    </div>
  );
}