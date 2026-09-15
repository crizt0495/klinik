import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listUsers } from "@/features/admin/service";
import { UsersView } from "@/features/admin/users-view";

export const metadata: Metadata = { title: "Pengguna" };

export default async function UsersPage() {
  const user = await getSessionUser();
  assertCan(user, "settings.manage");
  const users = await listUsers(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Pengguna" description="Kelola akun pengguna sistem." />
      <UsersView users={users} />
    </div>
  );
}