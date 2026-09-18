"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { createUserAction, assignUserRoleAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";
import { formatDateTime } from "@/lib/utils";

export interface UserRow { id: string; username: string; fullName: string; email: string | null; isActive: boolean; roles: string | null; lastLoginAt: Date | string | null; createdAt: Date | string }
export interface RoleRow { id: string; code: string; name: string; isSystem: boolean }

interface UsersViewProps {
  users: UserRow[];
  roles: RoleRow[];
  userRoleMap: Record<string, string[]>;
  canManageRoles: boolean;
}

export function UsersView({ users, roles, userRoleMap, canManageRoles }: UsersViewProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = React.useState(false);
  const [state, setState] = React.useState<ActionState>({});
  const [pending, setPending] = React.useState(false);

  const [roleTarget, setRoleTarget] = React.useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = React.useState<Set<string>>(new Set());
  const [rolePending, setRolePending] = React.useState(false);
  const [roleState, setRoleState] = React.useState<ActionState>({});

  const openRoleDialog = (user: UserRow) => {
    setRoleTarget(user);
    setSelectedRoles(new Set(userRoleMap[user.id] ?? []));
    setRoleState({});
  };

  const columns: DataTableColumn<UserRow>[] = [
    { id: "username", header: "Username", cell: (ctx) => <span className="font-medium">{ctx.row.original.username}</span> },
    { id: "fullName", header: "Nama Lengkap", accessorFn: (r) => r.fullName },
    { id: "email", header: "Email", cell: (ctx) => ctx.row.original.email ?? "-" },
    { id: "roles", header: "Role", cell: (ctx) => ctx.row.original.roles ? ctx.row.original.roles.split(",").map((r) => <Badge key={r} variant="outline" className="mr-1 text-xs">{r.trim()}</Badge>) : <span className="text-muted-foreground">-</span> },
    { id: "isActive", header: "Status", cell: (ctx) => <Badge variant={ctx.row.original.isActive ? "default" : "secondary"}>{ctx.row.original.isActive ? "Aktif" : "Nonaktif"}</Badge> },
    { id: "lastLoginAt", header: "Terakhir Login", cell: (ctx) => ctx.row.original.lastLoginAt ? formatDateTime(ctx.row.original.lastLoginAt) : "Belum pernah" },
    {
      id: "actions",
      header: "Aksi",
      cell: (ctx) => (
        <Button type="button" variant="outline" size="sm" disabled={!canManageRoles} onClick={() => openRoleDialog(ctx.row.original)}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Kelola Role
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Tambah User</Button></div>
      <DataTable columns={columns} data={users} searchPlaceholder="Cari user..." emptyTitle="Tidak ada user" emptyDescription="Belum ada user." />
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah User Baru</DialogTitle></DialogHeader>
          <form action={async (fd) => { setPending(true); const res = await createUserAction(state, fd); setPending(false); setState(res); if (res.success) { toast.success("User dibuat"); setShowCreate(false); router.refresh(); } }} className="space-y-4">
            {state.error ? <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{state.error}</p> : null}
            <div><Label className="text-xs">Username</Label><Input name="username" required minLength={3} className="mt-1" /></div>
            <div><Label className="text-xs">Nama Lengkap</Label><Input name="fullName" required className="mt-1" /></div>
            <div><Label className="text-xs">Email (opsional)</Label><Input name="email" type="email" className="mt-1" /></div>
            <div><Label className="text-xs">Password (min 8 karakter)</Label><Input name="password" type="password" required minLength={8} className="mt-1" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={pending}>Batal</Button>
              <Button type="submit" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={roleTarget !== null} onOpenChange={(open) => { if (!open) setRoleTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola Role — {roleTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada role. Buat role terlebih dahulu di menu Peran.</p>
            ) : (
              roles.map((role) => (
                <div key={role.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoles.has(role.id)}
                    onCheckedChange={() => {
                      setSelectedRoles((prev) => {
                        const next = new Set(prev);
                        if (next.has(role.id)) next.delete(role.id);
                        else next.add(role.id);
                        return next;
                      });
                    }}
                  />
                  <Label htmlFor={`role-${role.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    {role.name}
                    {role.isSystem ? <Badge>System</Badge> : <Badge variant="secondary">Custom</Badge>}
                  </Label>
                </div>
              ))
            )}
          </div>
          {roleState.error ? <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{roleState.error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleTarget(null)} disabled={rolePending}>Batal</Button>
            <Button
              type="button"
              disabled={!roleTarget || rolePending}
              onClick={async () => {
                if (!roleTarget) return;
                setRolePending(true);
                const fd = new FormData();
                fd.set("userId", roleTarget.id);
                fd.set("roleIds", JSON.stringify([...selectedRoles]));
                const res = await assignUserRoleAction(roleState, fd);
                setRolePending(false);
                setRoleState(res);
                if (res.success) {
                  toast.success("Role pengguna diperbarui");
                  setRoleTarget(null);
                  router.refresh();
                }
              }}
            >
              {rolePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />} Simpan Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}