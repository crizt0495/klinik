import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { getPurchaseOrder } from "@/features/inventory/service";
import { PODetailView, type PODetailData } from "@/features/inventory/po-detail-view";

export const metadata: Metadata = { title: "Detail PO" };

interface Props { params: Promise<{ id: string }> }

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  assertCan(user, "purchases.view");

  let data;
  try { data = await getPurchaseOrder(user, id); } catch { notFound(); }

  const po: PODetailData = {
    id: data.po.id,
    poNumber: data.po.poNumber,
    status: data.po.status,
    totalAmount: data.po.totalAmount,
    expectedDate: data.po.expectedDate,
    notes: data.po.notes,
    createdAt: data.po.createdAt,
    supplierName: data.supplierName,
    items: data.items.map((i) => ({ id: i.id, medicationName: i.medicationName, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, quantityReceived: i.receivedQuantity, subtotal: i.subtotal })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Purchase Order ${data.po.poNumber}`} description="Detail dan penerimaan PO." />
      <PODetailView po={po} />
    </div>
  );
}