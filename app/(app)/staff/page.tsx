import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listStaff } from "@/features/admin/service";
import { StaffView } from "./staff-view";

export const metadata: Metadata = { title: "Tenaga Medis" };

export default async function StaffPage() {
  const user = await getSessionUser();
  assertCan(user, "users.view");
  const staff = await listStaff(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Tenaga Medis" description="Daftar pegawai dan tenaga medis klinik." />
      <StaffView staff={staff} />
    </div>
  );
}
