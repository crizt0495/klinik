import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/features/reports/service";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "reports.view");
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const { from, to } = await searchParams;
  const dateFrom = from || defaultFrom;
  const dateTo = to || defaultTo;

  const stats = await getDashboardStats(user, dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan" description="Ringkasan data klinik berdasarkan periode." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Dari</label><input type="date" name="from" defaultValue={dateFrom} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12" /></div>
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Sampai</label><input type="date" name="to" defaultValue={dateTo} className="flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/12" /></div>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">Tampilkan</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Kunjungan</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.totalVisits}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Pendapatan</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">Rp {Number(stats.totalIncome).toLocaleString("id-ID")}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Pasien Baru</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.totalPatients}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Diagnosa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topDiagnoses.length === 0 ? <p className="text-xs text-muted-foreground">Tidak ada data.</p> : stats.topDiagnoses.map((d) => (
              <div key={d.code} className="flex items-center justify-between text-sm"><span>{d.code} — {d.name}</span><span className="font-medium">{d.count}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Obat</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.topMedications.length === 0 ? <p className="text-xs text-muted-foreground">Tidak ada data.</p> : stats.topMedications.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm"><span>{m.name}</span><span className="font-medium">{m.count}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}