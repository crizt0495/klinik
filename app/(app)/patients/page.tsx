import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/guard";
import { assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listPatients } from "@/features/patients/service";
import { PatientsView } from "@/features/patients/patients-view";

export const metadata: Metadata = { title: "Pasien" };

export default async function PatientsPage() {
  const user = await getSessionUser();
  assertCan(user, "patients.view");
  const patients = await listPatients(user);
  return (
    <div className="space-y-6">
      <PageHeader title="Pasien" description="Data pasien terdaftar di klinik." />
      <PatientsView
        patients={patients}
        canCreate={user.isSuperAdmin || user.permissions.has("patients.create")}
        canEdit={user.isSuperAdmin || user.permissions.has("patients.update")}
        canDelete={user.isSuperAdmin || user.permissions.has("patients.delete")}
      />
    </div>
  );
}