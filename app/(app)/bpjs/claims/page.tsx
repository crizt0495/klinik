import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listClaims, listVisitsForBpjs, listActiveSep } from "@/features/bpjs/service";
import { ClaimsView } from "@/features/bpjs/claims-view";

export const metadata: Metadata = { title: "Klaim BPJS" };

export default async function BpjsClaimsPage() {
  const user = await getSessionUser();
  assertCan(user, "bpjs.create_claim");
  const [claims, visits, seps] = await Promise.all([listClaims(user), listVisitsForBpjs(user), listActiveSep(user)]);
  return (
    <div className="space-y-4">
      <PageHeader title="Klaim BPJS" description="Buat, ajukan, dan pantau klaim BPJS Kesehatan (trial claim)." />
      <ClaimsView
        claims={claims}
        visits={visits}
        seps={seps}
        canCreate={user.permissions.has("bpjs.create_claim")}
        canSubmit={user.permissions.has("bpjs.submit_claim")}
      />
    </div>
  );
}