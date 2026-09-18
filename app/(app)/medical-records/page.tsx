import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listMedicalRecords } from "@/features/visits/service";
import { MedicalRecordsView } from "./medical-records-view";

export const metadata: Metadata = { title: "Rekam Medis" };

export default async function MedicalRecordsPage() {
  const user = await getSessionUser();
  assertCan(user, "medical_records.view");
  const records = await listMedicalRecords(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Rekam Medis" description="Daftar rekam medis pasien dari seluruh kunjungan." />
      <MedicalRecordsView records={records} />
    </div>
  );
}
