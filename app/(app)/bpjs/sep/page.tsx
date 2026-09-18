import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listSep, listActiveInsuranceProviders } from "@/features/bpjs/service";
import { SepView } from "@/features/bpjs/sep-view";

export const metadata: Metadata = { title: "SEP BPJS" };

export default async function BpjsSepPage({ searchParams }: { searchParams: Promise<{ noKartu?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "bpjs.view");
  const { noKartu } = await searchParams;
  const [seps, providers] = await Promise.all([listSep(user), listActiveInsuranceProviders(user)]);
  return (
    <div className="space-y-4">
      <PageHeader title="Surat Eligibilitas Peserta (SEP)" description="Buat, kelola, dan batalkan SEP BPJS Kesehatan." />
      <SepView
        seps={seps}
        providers={providers}
        canCreate={user.permissions.has("bpjs.manage_sep")}
        canCancel={user.permissions.has("bpjs.cancel_sep")}
        defaultNoKartu={noKartu}
      />
    </div>
  );
}