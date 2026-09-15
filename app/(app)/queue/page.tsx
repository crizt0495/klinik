import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listQueuesToday, listPatientsForQueue, listDepartmentsForQueue } from "@/features/queue/service";
import { QueueView } from "@/features/queue/queue-view";

export const metadata: Metadata = { title: "Antrian" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "queue.view");
  const { dept } = await searchParams;
  const [queues, patients, departments] = await Promise.all([listQueuesToday(user, dept), listPatientsForQueue(user), listDepartmentsForQueue(user)]);
  return (
    <div className="space-y-4">
      <PageHeader title="Antrian Hari Ini" description="Kelola antrian pasien hari ini." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Poli</label>
          <select name="dept" defaultValue={dept || ""} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">Semua Poli</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Filter</button>
      </form>
      <QueueView
        queues={queues}
        options={{ patients, departments }}
        canManage={user.isSuperAdmin || user.permissions.has("queue.create")}
      />
    </div>
  );
}