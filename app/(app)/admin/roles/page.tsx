import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { can } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { listRoles, listPermissions, getRolePermissions } from "@/features/admin/service";
import { RolesView } from "@/features/admin/roles-view";

export const metadata: Metadata = { title: "Peran" };

export default async function RolesPage() {
  const user = await getSessionUser();
  assertCan(user, "roles.view");
  const roles = await listRoles(user);
  const permissions = await listPermissions(user);
  const canManage = can(user, "roles.manage");
  const rolePermissionMap: Record<string, string[]> = {};
  for (const role of roles) {
    const rows = await getRolePermissions(user, role.id);
    rolePermissionMap[role.id] = rows.map((r) => r.permissionId);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Peran" description="Kelola peran dan hak akses." />
      <RolesView roles={roles} permissions={permissions} rolePermissionMap={rolePermissionMap} canManage={canManage} />
    </div>
  );
}