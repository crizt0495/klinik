"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface Settings { id: string; organizationName: string; address: string | null; phone: string | null; email: string | null; website: string | null; defaultCurrency: string }

export function SettingsView({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSave(fd: FormData) {
    setPending(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", body: JSON.stringify({ organizationName: fd.get("organizationName"), address: fd.get("address"), phone: fd.get("phone"), email: fd.get("email"), website: fd.get("website") }) });
      if (res.ok) { toast.success("Pengaturan tersimpan"); router.refresh(); } else toast.error("Gagal menyimpan");
    } catch { toast.error("Gagal menyimpan"); }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Informasi Organisasi</CardTitle></CardHeader>
      <CardContent>
        <form action={handleSave} className="space-y-4 max-w-xl">
          <div><Label className="text-xs">Nama Organisasi</Label><Input name="organizationName" defaultValue={settings.organizationName} required className="mt-1.5" /></div>
          <div><Label className="text-xs">Telepon</Label><Input name="phone" defaultValue={settings.phone ?? ""} className="mt-1.5" /></div>
          <div><Label className="text-xs">Email</Label><Input name="email" type="email" defaultValue={settings.email ?? ""} className="mt-1.5" /></div>
          <div><Label className="text-xs">Website</Label><Input name="website" defaultValue={settings.website ?? ""} className="mt-1.5" /></div>
          <div><Label className="text-xs">Alamat</Label><Textarea name="address" defaultValue={settings.address ?? ""} rows={3} className="mt-1.5" /></div>
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}