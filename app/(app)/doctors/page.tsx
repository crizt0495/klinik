import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listDoctors } from "@/features/appointments/service";
import { DoctorsView } from "./doctors-view";

export const metadata: Metadata = { title: "Dokter" };

export default async function DoctorsPage() {
  const user = await getSessionUser();
  assertCan(user, "appointments.view");
  const doctors = await listDoctors(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Dokter" description="Daftar dokter yang aktif di klinik." />
      <DoctorsView doctors={doctors} />
    </div>
  );
}
