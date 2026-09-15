import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPrescriptions } from "@/features/pharmacy/service";
import { PrescriptionsView } from "@/features/prescriptions/prescriptions-view";

export const metadata: Metadata = { title: "Resep" };

export default async function PrescriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "medical_records.view");
  const { status } = await searchParams;
  const prescriptions = await listPrescriptions(user, status);
  return (
    <div className="space-y-4">
      <PageHeader title="Resep" description="Daftar resep dokter." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={status || ""} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">Semua</option>
            {["ISSUED", "PARTIALLY_DISPENSED", "DISPENSED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Filter</button>
      </form>
      <PrescriptionsView prescriptions={prescriptions} />
    </div>
  );
}