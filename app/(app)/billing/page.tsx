import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listInvoices } from "@/features/billing/service";
import { InvoicesView } from "@/features/billing/invoices-view";

export const metadata: Metadata = { title: "Penagihan" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "billing.view");
  const { status } = await searchParams;
  const invoices = await listInvoices(user, status);
  return (
    <div className="space-y-4">
      <PageHeader title="Penagihan" description="Daftar invoice dan pembayaran." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={status || ""} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">Semua</option>
            {["ISSUED", "PARTIAL_PAID", "PAID", "REFUNDED", "VOID"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Filter</button>
      </form>
      <InvoicesView invoices={invoices} />
    </div>
  );
}