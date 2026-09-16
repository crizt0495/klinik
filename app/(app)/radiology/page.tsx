import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listRadiologyOrders, getRadiologyOrder } from "@/features/labs/service";
import { RadiologyOrdersView } from "@/features/labs/radiology-orders-view";

export const metadata: Metadata = { title: "Radiologi" };

export default async function RadiologyPage() {
  const user = await getSessionUser();
  assertCan(user, "radiology.view");
  const orders = await listRadiologyOrders(user);
  const details = await Promise.all(
    orders.slice(0, 50).map(async (o) => {
      const { order, patientName, patientMrn, visitNumber } = await getRadiologyOrder(user, o.id);
      return { orderId: order.id, procedureName: order.procedureName, clinicalInformation: order.clinicalInformation, status: order.status, createdAt: order.createdAt, patientName, patientMrn, visitNumber };
    }),
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Radiologi" description="Daftar order dan hasil radiologi." />
      <RadiologyOrdersView orders={orders} details={details} />
    </div>
  );
}