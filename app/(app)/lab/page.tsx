import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listLabOrders } from "@/features/labs/service";
import { LabOrdersView } from "@/features/labs/lab-orders-view";

export const metadata: Metadata = { title: "Laboratorium" };

export default async function LabPage() {
  const user = await getSessionUser();
  assertCan(user, "lab.view");
  const orders = await listLabOrders(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Laboratorium" description="Daftar order dan hasil laboratorium." />
      <LabOrdersView orders={orders} />
    </div>
  );
}