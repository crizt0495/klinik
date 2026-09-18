"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Shield, Trash2 } from "lucide-react";
import { MODULE_GROUPS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createRoleAction, updateRoleAction, deleteRoleAction, assignRolePermissionsAction } from "./actions";
import type { ActionState } from "@/lib/auth/action-guard";

export interface RoleRow { id: string; code: string; name: string; description: string | null; isSystem: boolean }
export interface PermissionRow { id: string; code: string; module: string }

interface RolesViewProps {
  roles: RoleRow[];
  permissions: PermissionRow[];
  rolePermissionMap: Record<string, string[]>;
  canManage: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  view: "Lihat",
  create: "Buat",
  update: "Ubah",
  delete: "Hapus",
  cancel: "Batal",
  call: "Panggil",
  skip: "Lewati",
  complete: "Selesaikan",
  dispense: "Racik",
  adjust: "Sesuaikan",
  opname: "Stok Opname",
  receive: "Terima",
  process: "Proses",
  verify: "Verifikasi",
  void: "Void",
  refund: "Refund",
  export: "Ekspor",
  manage: "Kelola",
  finalize: "Finalisasi",
  amend: "Amend",
};

function permissionLabel(code: string): string {
  const idx = code.indexOf(".");
  const mod = idx === -1 ? code : code.slice(0, idx);
  const action = idx === -1 ? "" : code.slice(idx + 1);
  const moduleLabel = mod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return action ? `${moduleLabel} — ${ACTION_LABELS[action] ?? action}` : moduleLabel;
}

export function RolesView({ roles, permissions, rolePermissionMap, canManage }: RolesViewProps) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(roles[0]?.id ?? null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);

  const [showCreate, setShowCreate] = React.useState(false);
  const [createState, setCreateState] = React.useState<ActionState>({});
  const [createPending, setCreatePending] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [editState, setEditState] = React.useState<ActionState>({});
  const [editPending, setEditPending] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [deleteState, setDeleteState] = React.useState<ActionState>({});
  const [deletePending, setDeletePending] = React.useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const permissionByCode = React.useMemo(() => new Map(permissions.map((p) => [p.code, p])), [permissions]);

  const initialPerms = rolePermissionMap[selectedRoleId ?? ""] ?? [];
  const changed = initialPerms.length !== selected.size || initialPerms.some((id) => !selected.has(id));

  const togglePerm = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setModulePerms = (permRows: PermissionRow[], value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of permRows) {
        if (value) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setPending(true);
    const fd = new FormData();
    fd.set("roleId", selectedRole.id);
    fd.set("permissionIds", JSON.stringify([...selected]));
    const res = await assignRolePermissionsAction({}, fd);
    setPending(false);
    if (res.success) {
      toast.success("Hak akses peran diperbarui");
      router.refresh();
    } else if (res.error) {
      toast.error(res.error);
    }
  };

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          {canManage ? (
            <Button className="w-full" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Tambah Role
            </Button>
          ) : null}
          {roles.map((role) => {
            const permCount = rolePermissionMap[role.id]?.length ?? 0;
            return (
              <Card
                key={role.id}
                className={cn("cursor-pointer p-4 transition-colors hover:bg-accent/50", selectedRoleId === role.id && "border-primary")}
                onClick={() => { setSelectedRoleId(role.id); setSelected(new Set(rolePermissionMap[role.id] ?? [])); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{role.name}</span>
                  </div>
                  <Badge variant={role.isSystem ? "default" : "secondary"}>{role.isSystem ? "System" : "Custom"}</Badge>
                </div>
                {role.description ? <p className="mt-1 truncate text-xs text-muted-foreground">{role.description}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{permCount} izin</p>
              </Card>
            );
          })}
        </aside>

        <main>
          {!selectedRole ? (
            <Card className="flex min-h-[320px] items-center justify-center p-6">
              <div className="space-y-2 text-center">
                <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pilih peran di sebelah kiri untuk melihat dan mengelola hak aksesnya.</p>
              </div>
            </Card>
          ) : selectedRole.code === "SUPER_ADMIN" || selectedRole.code === "OWNER" ? (
            <Card className="flex min-h-[320px] items-center justify-center p-6">
              <div className="max-w-sm space-y-2 text-center">
                <Shield className="mx-auto h-8 w-8 text-primary" />
                <h3 className="font-semibold">{selectedRole.name}</h3>
                <p className="text-sm text-muted-foreground">Role sistem utama memiliki semua akses dan tidak dapat diubah.</p>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{selectedRole.name}</h3>
                      <Badge variant={selectedRole.isSystem ? "default" : "secondary"}>{selectedRole.isSystem ? "System" : "Custom"}</Badge>
                    </div>
                    {selectedRole.description ? <p className="truncate text-xs text-muted-foreground">{selectedRole.description}</p> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && !selectedRole.isSystem ? (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowEdit(true)}>Ubah</Button>
                      <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>Hapus</Button>
                    </>
                  ) : null}
                  <Badge variant="outline">{selected.size} izin</Badge>
                </div>
              </div>

              {!canManage ? <p className="mt-4 text-xs text-muted-foreground">Anda hanya dapat melihat hak akses peran ini.</p> : null}

              <div className="mt-4 space-y-4">
                {Object.entries(MODULE_GROUPS).map(([moduleName, codes]) => {
                  const permRows = codes.map((code) => permissionByCode.get(code)).filter((p): p is PermissionRow => Boolean(p));
                  if (permRows.length === 0) return null;
                  const allSelected = permRows.every((p) => selected.has(p.id));
                  const hasSelected = permRows.some((p) => selected.has(p.id));
                  return (
                    <div key={moduleName} className="rounded-lg border border-border/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{moduleName}</h4>
                        {canManage ? (
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setModulePerms(permRows, true)} disabled={allSelected}>Pilih Semua</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setModulePerms(permRows, false)} disabled={!hasSelected}>Hapus Semua</Button>
                          </div>
                        ) : (
                          <Badge variant="outline">{permRows.length} izin</Badge>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {permRows.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Checkbox id={p.id} checked={selected.has(p.id)} disabled={!canManage} onCheckedChange={() => togglePerm(p.id)} />
                            <Label htmlFor={p.id} className={cn("cursor-pointer text-xs font-normal text-foreground", !canManage && "cursor-not-allowed text-muted-foreground")}>{permissionLabel(p.code)}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-end border-t pt-4">
                <Button onClick={handleSave} disabled={!canManage || !changed || pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Perubahan
                </Button>
              </div>
            </Card>
          )}
        </main>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Role Baru</DialogTitle></DialogHeader>
          <form
            action={async (fd) => {
              setCreatePending(true);
              const res = await createRoleAction(createState, fd);
              setCreatePending(false);
              setCreateState(res);
              if (res.success) {
                toast.success("Role berhasil dibuat");
                setShowCreate(false);
                router.refresh();
              }
            }}
            className="space-y-4"
          >
            {createState.error ? <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{createState.error}</p> : null}
            <div><Label className="text-xs">Nama Role</Label><Input name="name" required maxLength={128} className="mt-1" placeholder="cth. Kepala Apotek" /></div>
            <div><Label className="text-xs">Deskripsi (opsional)</Label><Textarea name="description" rows={3} className="mt-1" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={createPending}>Batal</Button>
              <Button type="submit" disabled={createPending}>{createPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) setEditState({}); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ubah Role</DialogTitle></DialogHeader>
          <form
            action={async (fd) => {
              setEditPending(true);
              fd.set("roleId", selectedRole?.id ?? "");
              const res = await updateRoleAction(editState, fd);
              setEditPending(false);
              setEditState(res);
              if (res.success) {
                toast.success("Role berhasil diubah");
                setShowEdit(false);
                router.refresh();
              }
            }}
            className="space-y-4"
          >
            {editState.error ? <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{editState.error}</p> : null}
            <div><Label className="text-xs">Nama Role</Label><Input name="name" required maxLength={128} defaultValue={selectedRole?.name ?? ""} className="mt-1" /></div>
            <div><Label className="text-xs">Deskripsi (opsional)</Label><Textarea name="description" rows={3} defaultValue={selectedRole?.description ?? ""} className="mt-1" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)} disabled={editPending}>Batal</Button>
              <Button type="submit" disabled={editPending}>{editPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={(open) => { setShowDelete(open); if (!open) setDeleteState({}); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Role</DialogTitle></DialogHeader>
          <form
            action={async (fd) => {
              setDeletePending(true);
              fd.set("roleId", selectedRole?.id ?? "");
              const res = await deleteRoleAction(deleteState, fd);
              setDeletePending(false);
              setDeleteState(res);
              if (res.success) {
                toast.success("Role berhasil dihapus");
                setShowDelete(false);
                router.refresh();
              }
            }}
            className="space-y-4"
          >
            {deleteState.error ? <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">{deleteState.error}</p> : null}
            <p className="text-sm text-muted-foreground">
              Hapus role <span className="font-medium text-foreground">{selectedRole?.name ?? ""}</span>? Tindakan ini tidak dapat dibatalkan. Role yang masih digunakan oleh pengguna tidak dapat dihapus.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDelete(false)} disabled={deletePending}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={deletePending}>{deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Hapus</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}