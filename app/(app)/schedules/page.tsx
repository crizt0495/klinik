import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listDoctorSchedules } from "@/features/appointments/service";
import { SchedulesView } from "./schedules-view";

export const metadata: Metadata = { title: "Jadwal Dokter" };

export default async function SchedulesPage() {
  const user = await getSessionUser();
  assertCan(user, "appointments.view");
  const schedules = await listDoctorSchedules(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Jadwal Dokter" description="Jadwal praktik dokter per poli dan hari." />
      <SchedulesView schedules={schedules} />
    </div>
  );
}
