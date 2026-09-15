import type { Metadata } from "next";
import Link from "next/link";
import { Users, CalendarDays, ListOrdered, Stethoscope, AlertTriangle, Pill, FlaskConical, ScanLine, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth/guard";
import { getDashboardStats } from "@/features/dashboard/queries";
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4 text-primary" /> Pendapatan Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatIDR(stats.todayRevenue)}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Piutang: <span className="font-medium text-foreground">{formatIDR(stats.outstandingAmount)}</span> ({stats.outstandingInvoices} invoice)
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {showClinical ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Aktivitas Terbaru</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                  ) : (
                    stats.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium">{a.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{a.entityType}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(a.createdAt)}>
                          {timeAgo(a.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {showPharmacy ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Pill className="h-4 w-4 text-primary" /> Farmasi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resep tertunda</span>
                  <Link href="/pharmacy" className="font-medium text-primary hover:underline">{stats.pendingPrescriptions}</Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Obat stok rendah</span>
                  <Link href="/inventory" className="flex items-center gap-1 font-medium text-warning hover:underline">
                    <AlertTriangle className="h-3.5 w-3.5" /> {stats.lowStock}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Obat mendekati kadaluarsa</span>
                  <Link href="/inventory/batches" className="font-medium text-warning hover:underline">{stats.expiringSoon}</Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {can(user, "laboratory.view") || can(user, "radiology.view") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Diagnostik</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <FlaskConical className="h-4 w-4" /> Laboratorium
                  </span>
                  <Link href="/laboratory" className="font-medium text-primary hover:underline">{stats.pendingLab}</Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <ScanLine className="h-4 w-4" /> Radiologi
                  </span>
                  <Link href="/radiology" className="font-medium text-primary hover:underline">{stats.pendingRad}</Link>
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
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}