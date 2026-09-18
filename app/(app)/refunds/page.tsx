import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listRefunds } from "@/features/billing/service";
import { RefundsView } from "./refunds-view";

export const metadata: Metadata = { title: "Refund" };

export default async function RefundsPage() {
  const user = await getSessionUser();
  assertCan(user, "payments.refund");
  const refunds = await listRefunds(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Refund" description="Riwayat pengembalian dana pasien." />
      <RefundsView refunds={refunds} />
    </div>
  );
}
