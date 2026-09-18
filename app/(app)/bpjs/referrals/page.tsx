import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listReferrals } from "@/features/bpjs/service";
import { ReferralsView } from "@/features/bpjs/referrals-view";

export const metadata: Metadata = { title: "Rujukan BPJS" };

export default async function BpjsReferralsPage() {
  const user = await getSessionUser();
  assertCan(user, "bpjs.view_referrals");
  const referrals = await listReferrals(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Rujukan BPJS" description="Rujukan peserta dari/menuju faskes lain yang diambil dari VClaim." />
      <ReferralsView
        referrals={referrals}
        canRefresh={user.permissions.has("bpjs.view_referrals")}
        canUpdate={user.permissions.has("bpjs.manage_referrals")}
      />
    </div>
  );
}