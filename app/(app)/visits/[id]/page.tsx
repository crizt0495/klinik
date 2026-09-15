import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getVisit, listDiagnoses, listProcedures, listMedications } from "@/features/visits/service";
import { VisitDetail, type VisitDetailData, type MasterOptions } from "@/features/visits/visit-detail";

export const metadata: Metadata = { title: "Detail Kunjungan" };

interface Props { params: Promise<{ id: string }> }

export default async function VisitDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  assertCan(user, "medical_records.view");

  let visit: VisitDetailData;
  try {
    visit = await getVisit(user, id) as VisitDetailData;
  } catch {
    notFound();
  }

  const [diagnoses, procedures, medications] = await Promise.all([listDiagnoses(user), listProcedures(user), listMedications(user)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Kunjungan ${visit.visitNumber}`}
        description={`${visit.patientName} · ${visit.visitDate} · ${visit.departmentName}`}
        actions={<StatusBadge status={visit.status} />}
      />
      <VisitDetail
        visit={visit}
        options={{ diagnoses, procedures, medications }}
        canEdit={(user.isSuperAdmin || user.permissions.has("medical_records.create")) && visit.status !== "COMPLETED" && visit.status !== "CANCELLED"}
        canFinalize={user.isSuperAdmin || user.permissions.has("medical_records.finalize")}
      />
    </div>
  );
}