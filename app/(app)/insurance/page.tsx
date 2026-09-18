import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listInsuranceProviders } from "@/features/patients/service";
import { InsuranceView } from "./insurance-view";

export const metadata: Metadata = { title: "Asuransi" };

export default async function InsurancePage() {
  const user = await getSessionUser();
  assertCan(user, "patients.view");
  const providers = await listInsuranceProviders(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Asuransi" description="Daftar penyedia asuransi yang bekerja sama." />
      <InsuranceView providers={providers} />
    </div>
  );
}
