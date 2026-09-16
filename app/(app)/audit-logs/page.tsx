import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { AuditLogsView } from "./audit-logs-view";
import { listAuditLogs } from "@/lib/services/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, Table } from "lucide-react";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; entityType?: string; from?: string; to?: string }> }) {
  const user = await getSessionUser();
  assertCan(user, "audit_logs.view");
  const { action, entityType, from, to } = await searchParams;
  const logs = await listAuditLogs(user, { action, entityType, dateFrom: from, dateTo: to });
  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" description="Log aktivitas sistem untuk keamanan dan kepatuhan." />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Aksi</Label>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="action" defaultValue={action || ""} placeholder="e.g. LOGIN" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipe Entitas</Label>
          <div className="relative">
            <Table className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="entityType" defaultValue={entityType || ""} placeholder="e.g. patients" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Dari</Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" name="from" defaultValue={from || ""} className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sampai</Label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" name="to" defaultValue={to || ""} className="pl-8" />
          </div>
        </div>
        <Button type="submit">Filter</Button>
        <Button variant="outline" asChild>
          <Link href="/audit-logs">Reset</Link>
        </Button>
      </form>
      <AuditLogsView logs={logs} />
    </div>
  );
}