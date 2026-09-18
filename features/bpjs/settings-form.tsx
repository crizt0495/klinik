"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BpjsConnection } from "@/lib/bpjs/types";
import { saveSettingsAction, testConnectionAction } from "./actions";

interface Props {
  connection: BpjsConnection;
}

export function SettingsForm({ connection }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(connection.enabled);
  const [mockMode, setMockMode] = React.useState(connection.mockMode);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("enabled", enabled ? "on" : "off");
    fd.set("mockMode", mockMode ? "on" : "off");
    try {
      const res = await saveSettingsAction({}, fd);
      if (res.success) {
        toast.success("Pengaturan BPJS disimpan");
        router.refresh();
      } else {
        toast.error(res.error ?? "Gagal menyimpan pengaturan");
      }
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnectionAction({}, new FormData());
      setTestResult(res.error ?? (res.data && typeof res.data === "object" && "message" in res.data ? String((res.data as { message: unknown }).message) : "Berhasil"));
      if (res.success) toast.success("Koneksi BPJS OK");
      else toast.error(res.error ?? "Gagal");
      router.refresh();
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {connection.enabled && connection.mockMode && (
        <Alert variant="warning">
          <AlertTitle>Mode Mock Aktif</AlertTitle>
          <AlertDescription>Koneksi BPJS saat ini berjalan dalam mode simulasi ({connection.serviceBaseUrl ?? "default"}). Nonaktifkan mode mock dan isi kredensial VClaim untuk integrasi produksi.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Status Koneksi</CardTitle>
          <CardDescription>Mode aktif: {mockMode ? "Mock / Simulasi" : "VClaim (produksi)"} · Status: {enabled ? "Diaktifkan" : "Nonaktif"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox id="enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            <label htmlFor="enabled" className="text-sm">Aktifkan fitur BPJS Kesehatan</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="mockMode" checked={mockMode} onCheckedChange={(v) => setMockMode(v === true)} />
            <label htmlFor="mockMode" className="text-sm">Gunakan mode Mock (simulasi, tanpa koneksi nyata)</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kredensial VClaim</CardTitle>
          <CardDescription>Konsumen VClaim BPJS Kesehatan a/k. Layanan Controller.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Service Base URL</Label>
            <Input name="serviceBaseUrl" defaultValue={connection.serviceBaseUrl ?? ""} placeholder="https://apijkn.bpjs-kesehatan.go.id" />
          </div>
          <div className="space-y-1.5">
            <Label>Faskes Code</Label>
            <Input name="faskesCode" defaultValue={connection.faskesCode ?? ""} placeholder="Kode faskes (9 digit)" />
          </div>
          <div className="space-y-1.5">
            <Label>Cons ID</Label>
            <Input name="consId" defaultValue={connection.consId} placeholder="Cons ID dari BPJS" />
          </div>
          <div className="space-y-1.5">
            <Label>Secret Key</Label>
            <Input name="secretKey" type="password" defaultValue={connection.secretKey} placeholder="Secret key konsumen" />
          </div>
          <div className="space-y-1.5">
            <Label>User Key</Label>
            <Input name="userKey" type="password" defaultValue={connection.userKey} placeholder="User key layanan" />
          </div>
          <div className="space-y-1.5">
            <Label>Nama Faskes</Label>
            <Input name="faskesName" defaultValue={connection.faskesName ?? ""} placeholder="Nama faskes tingkat pertama" />
          </div>
        </CardContent>
      </Card>

      {testResult && (
        <Alert variant={testing ? "default" : testResult.startsWith("Berhasil") || testResult.startsWith("OK") ? "success" : "destructive"}>
          <AlertTitle>Hasil Tes Koneksi</AlertTitle>
          <AlertDescription>{testResult}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={test} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} {testing ? "Menguji..." : "Tes Koneksi"}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}