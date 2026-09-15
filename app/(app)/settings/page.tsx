import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { getOrganizationSettings } from "@/lib/services/settings";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  assertCan(user, "settings.manage");
  const settings = await getOrganizationSettings(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Pengaturan" description="Pengaturan umum organisasi klinik." />
      <SettingsView settings={settings} />
    </div>
  );
}