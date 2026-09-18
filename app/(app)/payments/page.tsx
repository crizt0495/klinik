import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPaymentsDetailed } from "@/features/billing/service";
import { PaymentsView } from "./payments-view";

export const metadata: Metadata = { title: "Pembayaran" };

export default async function PaymentsPage() {
  const user = await getSessionUser();
  assertCan(user, "payments.view");
  const payments = await listPaymentsDetailed(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Pembayaran" description="Riwayat transaksi pembayaran pasien." />
      <PaymentsView payments={payments} />
    </div>
  );
}
