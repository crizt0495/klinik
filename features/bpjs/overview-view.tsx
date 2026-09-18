"use client";

import * as React from "react";
import { Activity, Building2, FileText, IdCard, Link2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import type { BpjsConnection } from "@/lib/bpjs/types";

export interface RecentSepRow { id: string; noSep: string | null; nama: string | null; tglSep: string; poliTujuan: string | null; status: string; statusSubmit: string }

interface Props {
  sepCurrentMonth: number;
  eligibilityCountToday: number;
  activeReferrals: number;
  totalSubmittedClaims: number;
  totalRejectedClaims: number;
  recentSep: RecentSepRow[];
  connection: BpjsConnection;
  canManageSettings: boolean;
}

export function OverviewView(props: Props) {
  const { connection, recentSep } = props;

  const columns: DataTableColumn<RecentSepRow>[] = [
    { id: "noSep", header: "No. SEP", accessorFn: (r) => r.noSep, cell: (ctx) => <span className="font-medium">{ctx.row.original.noSep}</span> },
    { id: "nama", header: "Peserta", accessorFn: (r) => r.nama ?? "-" },
    { id: "tglSep", header: "Tanggal", accessorFn: (r) => r.tglSep },
    { id: "poliTujuan", header: "Poli", accessorFn: (r) => r.poliTujuan },
    { id: "statusSubmit", header: "Submit", cell: (ctx) => <StatusBadge status={ctx.row.original.statusSubmit} /> },
    { id: "status", header: "Status", cell: (ctx) => <StatusBadge status={ctx.row.original.status} /> },
  ];

  const stats = [
    { label: "SEP Bulan Ini", value: String(props.sepCurrentMonth), icon: IdCard, href: "/bpjs/sep" },
    { label: "Cek Peserta Hari Ini", value: String(props.eligibilityCountToday), icon: Activity, href: "/bpjs/participants" },
    { label: "Rujukan Aktif", value: String(props.activeReferrals), icon: Link2, href: "/bpjs/referrals" },
    { label: "Nilai Klaim Dikirim", value: formatIDR(String(props.totalSubmittedClaims)), icon: FileText, href: "/bpjs/claims" },
    { label: "Klaim Ditolak", value: props.totalRejectedClaims > 0 ? formatIDR(String(props.totalRejectedClaims)) : "0", icon: Building2, href: "/bpjs/claims" },
  ];

  return (
    <div className="space-y-6">
      {!connection.enabled && (
        <Alert>
          <AlertTitle>Fitur BPJS Nonaktif</AlertTitle>
          <AlertDescription>
            Aktifkan BPJS Kesehatan di halaman{" "}
            <Link href="/bpjs/settings" className="underline underline-offset-2">Pengaturan BPJS</Link> sebelum digunakan.
            {props.canManageSettings ? "" : " Hubungi administrator untuk mengaktifkannya."}
          </AlertDescription>
        </Alert>
      )}
      {connection.enabled && connection.mockMode && (
        <Alert variant="warning">
          <AlertTitle>Mode Mock Aktif</AlertTitle>
          <AlertDescription>Data peserta & SEP sedang disimulasikan. Nonaktifkan mode mock di Pengaturan BPJS untuk koneksi VClaim nyata.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block">
            <Card className="transition-colors hover:border-ring/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <s.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.01em]">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEP Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={recentSep} searchPlaceholder="Cari SEP..." emptyTitle="Belum ada SEP" emptyDescription="Buat SEP untuk pasien BPJS." />
        </CardContent>
      </Card>
    </div>
  );
}