import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { can } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { listUsers, listUserRoleMap, listRoles } from "@/features/admin/service";
import { UsersView } from "@/features/admin/users-view";

export const metadata: Metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const user = await getSessionUser();
  assertCan(user, "users.view");
  const [users, roles, userRoleMap] = await Promise.all([listUsers(user), listRoles(user), listUserRoleMap(user)]);
  return (
    <div className="space-y-4">
      <PageHeader title="Pengguna" description="Kelola akun pengguna sistem." />
      <UsersView users={users} roles={roles} userRoleMap={userRoleMap} canManageRoles={can(user, "users.update")} />
    </div>
  );
}