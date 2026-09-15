import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { getInvoice } from "@/features/billing/service";
import { InvoiceDetailView, type InvoiceDetailData } from "@/features/billing/invoice-detail-view";

export const metadata: Metadata = { title: "Detail Invoice" };

interface Props { params: Promise<{ id: string }> }

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  assertCan(user, "billing.view");
  let data;
  try { data = await getInvoice(user, id); } catch { notFound(); }

  const invoice: InvoiceDetailData = {
    id: data.invoice.id,
    invoiceNumber: data.invoice.invoiceNumber,
    status: data.invoice.status,
    totalAmount: data.invoice.total,
    paidAmount: data.invoice.paidAmount,
    patientName: data.patientName,
    patientMrn: data.patientMrn,
    visitNumber: "", // will be from relation
    createdAt: data.invoice.createdAt,
    items: data.items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal, discount: i.discount })),
    payments: data.payments.map((p) => ({ id: p.id, paymentNumber: p.paymentNumber, method: p.paymentMethod, amount: p.amount, reference: p.referenceNumber, status: p.status, paidAt: p.paymentDate })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Invoice ${data.invoice.invoiceNumber}`} description={`${data.patientName} · ${data.patientMrn}`} />
      <InvoiceDetailView invoice={invoice} />
    </div>
  );
}