import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, genderLabel, ageFromBirthDate } from "@/lib/utils";
import { getPatientDetail, getPatientTimeline } from "@/features/patients/service";
import { PatientEditButton } from "@/features/patients/patient-edit-button";
import { InsuranceDialog } from "@/features/patients/insurance-dialog";

export const metadata: Metadata = { title: "Detail Pasien" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getSessionUser();
  assertCan(user, "patients.view");

  let detail;
  try {
    detail = await getPatientDetail(user, id);
  } catch {
    notFound();
  }
  const { patient, insurance, providers } = detail;
  const timeline = await getPatientTimeline(user, id);

  const info: Array<[string, string]> = [
    ["NIK", patient.nik ?? "-"],
    ["Jenis Kelamin", genderLabel(patient.gender)],
    ["Usia", ageFromBirthDate(patient.birthDate) == null ? "-" : `${ageFromBirthDate(patient.birthDate)} tahun`],
    ["Tanggal Lahir", formatDate(patient.birthDate)],
    ["Tempat Lahir", patient.birthPlace ?? "-"],
    ["Golongan Darah", patient.bloodType ?? "-"],
    ["Status Pernikahan", patient.maritalStatus ?? "-"],
    ["Pekerjaan", patient.occupation ?? "-"],
    ["No. HP", patient.phone ?? "-"],
    ["Email", patient.email ?? "-"],
    ["Kontak Darurat", patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactPhone ?? "-"})` : "-"],
    ["Alamat", patient.address ?? "-"],
  ];

  const formPatient = {
    id: patient.id,
    fullName: patient.fullName,
    nik: patient.nik,
    birthPlace: patient.birthPlace,
    birthDate: patient.birthDate,
    gender: patient.gender,
    bloodType: patient.bloodType,
    maritalStatus: patient.maritalStatus,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    occupation: patient.occupation,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient.fullName}
        description={`${patient.medicalRecordNumber} · Terdaftar ${formatDate(patient.createdAt)}`}
        actions={
          <>
            <StatusBadge status={patient.status} />
            {user.isSuperAdmin || user.permissions.has("patients.update") ? <PatientEditButton patient={formPatient} /> : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Identitas Pasien</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k} className="text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Riwayat & Aktivitas</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada aktivitas untuk pasien ini.</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((ev) => (
                    <Link key={`${ev.type}-${ev.id}`} href={ev.href} className="flex items-center justify-between rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-muted/40">
                      <div>
                        <p className="font-medium">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">{ev.type} · {formatDate(ev.date)} · {ev.sub}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Jaminan Asuransi</CardTitle>
              {user.isSuperAdmin || user.permissions.has("patients.update") ? <InsuranceDialog patientId={patient.id} providers={providers} /> : null}
            </CardHeader>
            <CardContent>
              {insurance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada asuransi.</p>
              ) : (
                <div className="space-y-2">
                  {insurance.map((ins) => (
                    <div key={ins.id} className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{ins.providerName}</p>
                        {ins.isPrimary ? <StatusBadge status="ACTIVE" /> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">No. {ins.memberNumber}{ins.coverageClass ? ` · Kelas ${ins.coverageClass}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}