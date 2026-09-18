import type { Metadata } from "next";
import { getSessionUser, assertCan } from "@/lib/auth/guard";
import { PageHeader } from "@/components/page-header";
import { listRooms } from "@/features/appointments/service";
import { RoomsView } from "./rooms-view";

export const metadata: Metadata = { title: "Ruangan" };

export default async function RoomsPage() {
  const user = await getSessionUser();
  assertCan(user, "settings.view");
  const rooms = await listRooms(user);
  return (
    <div className="space-y-4">
      <PageHeader title="Ruangan" description="Daftar ruangan pemeriksaan dan tindakan." />
      <RoomsView rooms={rooms} />
    </div>
  );
}
