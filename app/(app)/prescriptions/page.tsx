import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPrescriptions, getPrescription } from "@/features/pharmacy/service";
import { PrescriptionsView } from "@/features/prescriptions/prescriptions-view";

export const metadata: Metadata = { title: "Resep" };

export default async function PrescriptionsPage() {
  const user = await getSessionUser();
  assertCan(user, "medical_records.view");
  const prescriptions = await listPrescriptions(user);
  const details = await Promise.all(
    prescriptions.slice(0, 30).map(async (p) => {
      const d = await getPrescription(user, p.id);
      return { prescriptionId: p.id, items: d.items };
    }),
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Resep" description="Daftar resep dokter." />
      <PrescriptionsView prescriptions={prescriptions} details={details} />
    </div>
  );
}