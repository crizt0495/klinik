"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Wifi, FlaskConical, Server, Power, Info, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { BpjsSettingsView } from "./service";
import { saveSettingsAction, testConnectionAction } from "./actions";

type Mode = "demo" | "production" | "off";

const URL_PRESETS: Array<{ label: string; url: string; hint: string }> = [
  { label: "Development BPJS", url: "https://dvlp.bpjs-kesehatan.go.id", hint: "Untuk uji coba / integrasi" },
  { label: "Produksi BPJS", url: "https://apijkn.bpjs-kesehatan.go.id", hint: "Untuk rilis / go-live" },
];

const MODES: Array<{ value: Mode; title: string; description: string; icon: React.ReactNode }> = [
  {
    value: "demo",
    title: "Mode Demo / Simulasi",
    description: "Semua fitur berjalan dengan data simulasi, tanpa kredensial. Cocok untuk mencoba aplikasi.",
    icon: <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />,
  },
  {
    value: "production",
    title: "Mode Produksi (VClaim BPJS)",
    description: "Terhubung ke server VClaim asli BPJS Kesehatan. Perlu Cons ID, Secret Key, User Key, dan kode faskes.",
    icon: <Server className="h-4 w-4 shrink-0 text-muted-foreground" />,
  },
  {
    value: "off",
    title: "Nonaktif",
    description: "Matikan seluruh fitur BPJS. Data SEP, rujukan, dan klaim yang sudah ada tetap tersimpan.",
    icon: <Power className="h-4 w-4 shrink-0 text-muted-foreground" />,
  },
];

interface Props {
  connection: BpjsSettingsView;
}

export function SettingsForm({ connection }: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(!connection.enabled ? "off" : connection.mockMode ? "demo" : "production");
  const [url, setUrl] = React.useState(connection.serviceBaseUrl ?? "");
  const [noKartuTest, setNoKartuTest] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  const managedByEnv = connection.managedByEnv === true;
  const busy = saving || testing;

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const fd = new FormData();
      const card = noKartuTest.trim();
      if (card) fd.set("noKartu", card);
      const res = await testConnectionAction({}, fd);
      const message =
        res.error ??
        (res.data && typeof res.data === "object" && "message" in res.data
          ? String((res.data as { message: unknown }).message)
          : "Koneksi berhasil");
      setTestResult({ ok: Boolean(res.success), message });
      if (res.success) toast.success("Koneksi BPJS OK");
      else toast.error(message);
      router.refresh();
    } finally {
      setTesting(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>, thenTest = false) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("enabled", mode === "off" ? "off" : "on");
      fd.set("mockMode", mode === "off" ? (connection.mockMode ? "on" : "off") : mode === "demo" ? "on" : "off");
      const res = await saveSettingsAction({}, fd);
      if (!res.success) {
        toast.error(res.error ?? "Gagal menyimpan pengaturan");
        return;
      }
      toast.success("Pengaturan BPJS disimpan");
      router.refresh();
      if (thenTest) await runTest();
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    submit(e, submitter?.dataset.action === "saveAndTest");
  }

  const statusBadge =
    managedByEnv ? (
      <Badge variant="outline">Env override</Badge>
    ) : mode === "off" ? (
      <Badge variant="muted">Nonaktif</Badge>
    ) : mode === "demo" ? (
      <Badge variant="warning">Mode Simulasi</Badge>
    ) : (
      <Badge variant="success">VClaim Aktif</Badge>
    );

  const lastTestOk = connection.lastTestStatus?.startsWith("OK") ?? false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {managedByEnv && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Pengaturan dikelola oleh environment variable</AlertTitle>
          <AlertDescription>
            Server ini memakai <code className="text-xs">BPJS_ENABLED</code>, <code className="text-xs">BPJS_CONS_ID</code> dan sejenisnya dari
            environment (umum saat deployment produksi). Kredensial tidak tersimpan di database, sehingga form ini hanya untuk melihat.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {statusBadge}
        {connection.lastTestStatus && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {lastTestOk ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
            Uji terakhir: {formatDateTime(connection.lastTestedAt)} — {connection.lastTestStatus}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mode BPJS</CardTitle>
          <CardDescription>Pilih satu mode. Pilihan ini menentukan apakah data BPJS memakai simulasi atau koneksi nyata VClaim.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={managedByEnv} className="gap-3">
            {MODES.map((opt) => (
              <label
                key={opt.value}
                htmlFor={`bpjs-mode-${opt.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors select-none",
                  mode === opt.value ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40",
                  managedByEnv && "cursor-not-allowed opacity-70",
                )}
              >
                <RadioGroupItem value={opt.value} id={`bpjs-mode-${opt.value}`} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {opt.icon}
                    {opt.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {mode === "production" && (
        <Card>
          <CardHeader>
            <CardTitle>Kredensial VClaim</CardTitle>
            <CardDescription>Kredensial diambil dari akun konsumen VClaim BPJS Kesehatan a/k. Layanan Controller. Semua wajib diisi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="svc-serviceBaseUrl">Service Base URL</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="svc-serviceBaseUrl"
                  name="serviceBaseUrl"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={managedByEnv}
                  placeholder="https://apijkn.bpjs-kesehatan.go.id"
                  className="min-w-56 flex-1"
                />
                {URL_PRESETS.map((p) => (
                  <Button key={p.url} type="button" variant="outline" size="sm" disabled={managedByEnv} onClick={() => setUrl(p.url)} title={p.hint}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Gunakan preset: <strong>Development</strong> untuk uji coba, <strong>Produksi</strong> untuk go-live.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-consId">Cons ID</Label>
              <Input id="svc-consId" name="consId" defaultValue={connection.consId} required disabled={managedByEnv} placeholder="Contoh: 12345678" />
              <p className="text-xs text-muted-foreground">Cons ID konsumen (8 digit) dari email registrasi VClaim BPJS.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-secretKey">Secret Key</Label>
              <Input id="svc-secretKey" name="secretKey" type="password" defaultValue={connection.secretKey} required disabled={managedByEnv} placeholder="Secret key konsumen" />
              <p className="text-xs text-muted-foreground">Secret Key dari email yang sama. Simpan rahasia.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-userKey">User Key</Label>
              <Input id="svc-userKey" name="userKey" type="password" defaultValue={connection.userKey} required disabled={managedByEnv} placeholder="User key layanan" />
              <p className="text-xs text-muted-foreground">Dari menu <strong>Manajemen → User</strong> di aplikasi P-Care BPJS.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-faskesCode">Kode Faskes</Label>
              <Input id="svc-faskesCode" name="faskesCode" defaultValue={connection.faskesCode ?? ""} disabled={managedByEnv} placeholder="Contoh: 00010101234" />
              <p className="text-xs text-muted-foreground">Kode faskes (9 digit) dari profil P-Care faskes Anda.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="svc-faskesName">Nama Faskes</Label>
              <Input id="svc-faskesName" name="faskesName" defaultValue={connection.faskesName ?? ""} disabled={managedByEnv} placeholder="Nama resmi faskes tingkat pertama" />
              <p className="text-xs text-muted-foreground">Nama resmi faskes — dipakai untuk tampilan pada laporan/klaim.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "demo" && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Mode simulasi aktif</AlertTitle>
          <AlertDescription>
            SEP, rujukan, dan klaim akan berjalan dengan data simulasi yang realistis — tanpa koneksi ke server BPJS. Anda bisa menguji seluruh
            alur sekarang juga, lalu pindah ke Mode Produksi saat kredensial VClaim sudah tersedia.
          </AlertDescription>
        </Alert>
      )}

      {mode === "off" && (
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle>Fitur BPJS dimatikan</AlertTitle>
          <AlertDescription>Seluruh halaman dan menu BPJS tidak akan aktif. Data yang sudah masuk tetap aman di database.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Uji Koneksi</CardTitle>
          <CardDescription>
            Periksa apakah kredensial yang tersimpan berfungsi — aplikasi akan mencoba mengambil data peserta BPJS.
            {mode === "production" && !managedByEnv && " Gunakan “Simpan & Uji” agar kredensial yang baru diketik ikut diuji."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="svc-testCard">Nomor Kartu Uji (opsional)</Label>
            <Input
              id="svc-testCard"
              value={noKartuTest}
              onChange={(e) => setNoKartuTest(e.target.value)}
              placeholder="Contoh: 0002000000000 — kosongkan untuk memakai kartu sampel"
              className="max-w-md"
            />
            <p className="text-xs text-muted-foreground">Gunakan nomor kartu pasien BPJS asli untuk memastikan kredensial valid.</p>
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? "success" : "destructive"}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>Hasil Tes Koneksi</AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={runTest} disabled={busy}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} {testing ? "Menguji..." : "Uji Koneksi"}
            </Button>
            <Button type="submit" variant="secondary" data-action="saveAndTest" disabled={busy || managedByEnv}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan &amp; Uji
            </Button>
            <Button type="submit" disabled={busy || managedByEnv}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pengaturan
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}