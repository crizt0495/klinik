import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_DEFINITIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await getSessionUser();
  const fields: Array<{ label: string; value: string }> = [
    { label: "Nama Lengkap", value: user.fullName },
    { label: "Username", value: `@${user.username}` },
    { label: "Email", value: user.email ?? "-" },
    { label: "Organisasi", value: user.organizationId },
    { label: "Cabang", value: user.branchId ?? "Semua cabang" },
    { label: "Jumlah Izin", value: String(user.permissions.size) },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Profil" description="Informasi akun dan peran Anda pada sistem." />
      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="space-y-0.5">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium break-all">{field.value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Peran</p>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.length > 0 ? (
                user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {ROLE_DEFINITIONS[role]?.name ?? role}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
              {user.isSuperAdmin ? <Badge>Super Admin</Badge> : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Status akun: {user.isActive ? "Aktif" : "Nonaktif"} · Organisasi: {user.organizationStatus}
            {user.branchStatus ? ` · Cabang: ${user.branchStatus}` : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
