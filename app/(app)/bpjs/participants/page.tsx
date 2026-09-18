import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listEligibilityChecks } from "@/features/bpjs/service";
import { ParticipantCheck } from "@/features/bpjs/participant-check";

export const metadata: Metadata = { title: "Cek Peserta BPJS" };

export default async function BpjsParticipantsPage() {
  const user = await getSessionUser();
  assertCan(user, "bpjs.check");
  const recentChecks = await listEligibilityChecks(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Cek Peserta BPJS" description="Periksa kelayakan peserta melalui VClaim (nomor kartu, NIK, atau nama)." />
      <ParticipantCheck recentChecks={recentChecks} />
    </div>
  );
}