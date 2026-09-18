import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { getBpjsOverview, getBpjsSettingsView } from "@/features/bpjs/service";
import { OverviewView } from "@/features/bpjs/overview-view";

export const metadata: Metadata = { title: "Dashboard BPJS" };

export default async function BpjsDashboardPage() {
  const user = await getSessionUser();
  assertCan(user, "bpjs.view");
  const overview = await getBpjsOverview(user);
  const connection = await getBpjsSettingsView(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard BPJS" description="Ringkasan aktivitas BPJS Kesehatan dan status koneksi VClaim." />
      <OverviewView
        sepCurrentMonth={overview.sepCurrentMonth}
        eligibilityCountToday={overview.eligibilityCountToday}
        activeReferrals={overview.activeReferrals}
        totalSubmittedClaims={overview.totalSubmittedClaims}
        totalRejectedClaims={overview.totalRejectedClaims}
        recentSep={overview.recentSep}
        connection={connection}
        canManageSettings={user.permissions.has("bpjs.manage_settings")}
      />
    </div>
  );
}