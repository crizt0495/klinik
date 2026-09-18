import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listDepartments } from "@/features/appointments/service";
import { DepartmentsView } from "./departments-view";

export const metadata: Metadata = { title: "Poli" };

export default async function DepartmentsPage() {
  const user = await getSessionUser();
  assertCan(user, "settings.view");
  const departments = await listDepartments(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Poli" description="Daftar unit pelayanan (poli) di klinik." />
      <DepartmentsView departments={departments} />
    </div>
  );
}
