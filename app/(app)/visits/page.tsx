import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { listVisits } from "@/features/visits/service";
import { VisitsView } from "@/features/visits/visits-view";
import { RegisterVisitDialog } from "@/features/visits/register-visit-dialog";
import { listDoctors, listDepartments } from "@/features/appointments/service";
import { listPatientsForQueue } from "@/features/queue/service";

export const metadata: Metadata = { title: "Kunjungan" };

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ date?: string; status?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "medical_records.view");
  const { date, status } = await searchParams;
  const visits = await listVisits(user, date || todayISO(), status);
  const canRegister = user.isSuperAdmin || user.permissions.has("queue.create");
  let options;
  if (canRegister) {
    const [patients, doctors, departments] = await Promise.all([listPatientsForQueue(user), listDoctors(user), listDepartments(user)]);
    options = { patients, doctors, departments };
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Kunjungan" description="Kunjungan pasien hari ini." actions={canRegister && options ? <RegisterVisitDialog options={options} /> : null} />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tanggal</label>
          <input type="date" name="date" defaultValue={date || todayISO()} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={status || ""} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12">
            <option value="">Semua</option>
            {["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">Filter</button>
      </form>
      <VisitsView visits={visits} canRegister={canRegister} />
    </div>
  );
}