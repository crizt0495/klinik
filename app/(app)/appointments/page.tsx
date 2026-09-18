import type { Metadata } from "next";
import { todayISO } from "@/lib/utils";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listAppointments, listDoctors, listDepartments, listRooms, listPatientsOptions } from "@/features/appointments/service";
import { AppointmentsView } from "@/features/appointments/appointments-view";
import { AppointmentCreateButton } from "@/features/appointments/appointment-create-button";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string; status?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "appointments.view");
  const { date, status } = await searchParams;
  const appointments = await listAppointments(user, date || todayISO(), status);
  const canCreate = user.isSuperAdmin || user.permissions.has("appointments.create");
  let options;
  if (canCreate) {
    const [patients, doctors, departments, rooms] = await Promise.all([listPatientsOptions(user), listDoctors(user), listDepartments(user), listRooms(user)]);
    options = { patients, doctors, departments, rooms };
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="Appointment"
        description="Jadwal kunjungan pasien ke dokter."
        actions={canCreate && options ? <AppointmentCreateButton options={options} /> : null}
      />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tanggal</label>
          <input type="date" name="date" defaultValue={date || todayISO()} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={status || ""} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
            <option value="">Semua</option>
            {["SCHEDULED", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">Filter</button>
      </form>
      <AppointmentsView appointments={appointments} canUpdate={user.isSuperAdmin || user.permissions.has("appointments.update")} />
    </div>
  );
}