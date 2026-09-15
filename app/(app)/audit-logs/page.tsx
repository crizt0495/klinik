import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { AuditLogsView } from "./audit-logs-view";
import { listAuditLogs } from "@/lib/services/audit";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; entityType?: string; from?: string; to?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "settings.manage");
  const { action, entityType, from, to } = await searchParams;
  const logs = await listAuditLogs(user, { action, entityType, dateFrom: from, dateTo: to });
  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" description="Log aktivitas sistem untuk keamanan dan kepatuhan." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Aksi</label><input name="action" defaultValue={action || ""} placeholder="e.g. LOGIN" className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Tipe Entitas</label><input name="entityType" defaultValue={entityType || ""} placeholder="e.g. patients" className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Dari</label><input type="date" name="from" defaultValue={from || ""} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
        <div className="space-y-1.5"><label className="text-xs text-muted-foreground">Sampai</label><input type="date" name="to" defaultValue={to || ""} className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
        <button type="submit" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">Filter</button>
      </form>
      <AuditLogsView logs={logs} />
    </div>
  );
}