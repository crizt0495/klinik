import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listLabOrders, getLabOrder } from "@/features/labs/service";
import { LabOrdersView } from "@/features/labs/lab-orders-view";

export const metadata: Metadata = { title: "Laboratorium" };

export default async function LabPage() {
  const user = await getSessionUser();
  assertCan(user, "laboratory.view");
  const orders = await listLabOrders(user);
  const details = await Promise.all(
    orders.slice(0, 50).map(async (o) => {
      const { order, items, patientName, patientMrn, visitNumber } = await getLabOrder(user, o.id);
      return { orderId: order.id, items, patientName, patientMrn, visitNumber };
    }),
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Laboratorium" description="Daftar order dan hasil laboratorium." />
      <LabOrdersView orders={orders} details={details} />
    </div>
  );
}