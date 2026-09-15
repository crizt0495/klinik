import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPharmacyQueue } from "@/features/pharmacy/service";
import { PharmacyView } from "@/features/pharmacy/pharmacy-view";

export const metadata: Metadata = { title: "Farmasi" };

export default async function PharmacyPage() {
  const user = await getSessionUser();
  assertCan(user, "pharmacy.dispense");
  const prescriptions = await listPharmacyQueue(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Farmasi" description="Antrian resep yang siap diserahkan (dispersing FEFO)." />
      <PharmacyView prescriptions={prescriptions} />
    </div>
  );
}