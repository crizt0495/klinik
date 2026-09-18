import type { Metadata } from "next";
import Link from "next/link";
import { Users, CalendarDays, ListOrdered, Stethoscope, AlertTriangle, Pill, FlaskConical, ScanLine, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guard";
import { getDashboardStats, getDashboardTrend } from "@/features/dashboard/queries";
import { RevenueChart } from "@/features/dashboard/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatIDR, timeAgo, formatDateTime } from "@/lib/utils";
import { can } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  const stats = await getDashboardStats(user);

  const showFinance = can(user, "billing.view") || can(user, "payments.view");
  const showPharmacy = can(user, "pharmacy.view");
  const showClinical = can(user, "queue.view") || can(user, "medical_records.view");

  const trend = showFinance ? await getDashboardTrend(user) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Selamat datang, ${user.fullName}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Pasien" value={String(stats.totalPatients)} href="/patients" />
        <StatCard icon={CalendarDays} label="Appointment Hari Ini" value={String(stats.todayAppointments)} href="/appointments" />
        <StatCard icon={ListOrdered} label="Antrian Hari Ini" value={String(stats.todayOnQueue)} href="/queue" />
        <StatCard icon={Stethoscope} label="Kunjungan Hari Ini" value={String(stats.todayVisits)} href="/visits" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {showFinance ? (
            <Card className="overflow-hidden">
              <CardContent className="relative p-6">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative space-y-1">
                  <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Pendapatan Hari Ini
                  </p>
                  <p className="nums text-3xl font-semibold tracking-[-0.02em]">{formatIDR(stats.todayRevenue)}</p>
                  <p className="text-sm text-muted-foreground">
                    Piutang <span className="nums font-medium text-foreground">{formatIDR(stats.outstandingAmount)}</span> · {stats.outstandingInvoices} invoice
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {trend ? <RevenueChart data={trend} /> : null}

          {showClinical ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px] font-medium text-muted-foreground">Aktivitas Terbaru</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {stats.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium capitalize">{a.action.replace(/_/g, " ")}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.entityType}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                          {timeAgo(a.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {showPharmacy ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                  <Pill className="h-3.5 w-3.5 text-primary" /> Farmasi
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60 text-sm">
                <div className="flex items-center justify-between pb-3">
                  <span className="text-muted-foreground">Resep tertunda</span>
                  <Link href="/pharmacy" className="nums font-medium text-primary hover:underline">{stats.pendingPrescriptions}</Link>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-muted-foreground">Obat stok rendah</span>
                  <Link href="/inventory" className="nums flex items-center gap-1 font-medium text-[color-mix(in_oklch,var(--warning)_62%,black)] hover:underline dark:text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> {stats.lowStock}
                  </Link>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-muted-foreground">Mendekati kadaluarsa</span>
                  <Link href="/inventory/batches" className="nums font-medium text-[color-mix(in_oklch,var(--warning)_62%,black)] hover:underline dark:text-warning">{stats.expiringSoon}</Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {can(user, "laboratory.view") || can(user, "radiology.view") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px] font-medium text-muted-foreground">Diagnostik</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <FlaskConical className="h-4 w-4" /> Laboratorium
                  </span>
                  <Link href="/laboratory" className="nums font-medium text-primary hover:underline">{stats.pendingLab}</Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ScanLine className="h-4 w-4" /> Radiologi
                  </span>
                  <Link href="/radiology" className="nums font-medium text-primary hover:underline">{stats.pendingRad}</Link>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href }: { icon: typeof Users; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-pop">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="nums text-2xl font-semibold tracking-[-0.02em]">{value}</p>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <Icon className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
