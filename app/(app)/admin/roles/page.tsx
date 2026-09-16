import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listRoles } from "@/features/admin/service";
import { RolesView } from "@/features/admin/roles-view";

export const metadata: Metadata = { title: "Peran" };

export default async function RolesPage() {
  const user = await getSessionUser();
  assertCan(user, "roles.view");
  const roles = await listRoles(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Peran" description="Kelola peran dan hak akses." />
      <RolesView roles={roles} />
    </div>
  );
}