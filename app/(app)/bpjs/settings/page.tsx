import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { getBpjsSettingsView } from "@/features/bpjs/service";
import { SettingsForm } from "@/features/bpjs/settings-form";

export const metadata: Metadata = { title: "Pengaturan BPJS" };

export default async function BpjsSettingsPage() {
  const user = await getSessionUser();
  assertCan(user, "bpjs.manage_settings");
  const connection = await getBpjsSettingsView(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Pengaturan BPJS" description="Konfigurasi koneksi VClaim BPJS Kesehatan." />
      <SettingsForm connection={connection} />
    </div>
  );
}