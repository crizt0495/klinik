import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { listUsers, createUser, listRoles, listPermissions, createRole, getRolePermissions, assignRolePermissions, assignUserRole } from "@/features/admin/service";
import { ConflictError } from "@/lib/errors";

let admin: SessionUser;

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
}, 120000);

describe("modul administrasi (pengguna & peran)", () => {
  it("1. listRoles memuat peran sistem", async () => {
    const roles = await listRoles(admin);
    const codes = roles.map((r) => r.code);
    expect(codes).toContain("ADMIN_KLINIK");
    expect(codes).toContain("DOKTER");
    expect(codes).toContain("KASIR");
  });

  it("2. listPermissions memuat permission inti", async () => {
    const perms = await listPermissions(admin);
    const codes = perms.map((p) => p.code);
    expect(codes).toContain("patients.view");
    expect(codes).toContain("billing.view");
    expect(codes).toContain("settings.manage");
  });

  it("3. createUser menambahkan pengguna ke daftar", async () => {
    const username = `uji.user.${Date.now()}`;
    const created = await createUser(admin, { username, fullName: "Uji Pengguna", password: "Uji@2026" });
    expect(created).toHaveProperty("id");
    const users = await listUsers(admin);
    expect(users.some((u) => u.username === username)).toBe(true);
  });

  it("4. createUser dengan username duplikat ditolak", async () => {
    const username = `dupe.user.${Date.now()}`;
    await createUser(admin, { username, fullName: "Dupe Satu", password: "Dupe@2026" });
    await expect(createUser(admin, { username, fullName: "Dupe Dua", password: "Dupe@2026" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("5. pengguna baru dapat login dengan password yang dibuat", async () => {
    const username = `login.user.${Date.now()}`;
    await createUser(admin, { username, fullName: "Login Pengguna", password: "Login@2026" });
    const result = await loginWithPassword(username, "Login@2026");
    expect(result.sessionUser.username).toBe(username);
  });

  it("6. createRole membuat peran baru dengan kode turunan", async () => {
    const role = await createRole(admin, { name: "Peran Uji E2E", description: "Uji" });
    expect(role.code).toBe("PERAN_UJI_E2E");
    expect(role.isSystem).toBe(false);
  });

  it("7. createRole dengan nama kosong ditolak", async () => {
    await expect(createRole(admin, { name: "   " })).rejects.toBeInstanceOf(ConflictError);
  });

  it("8. createRole dengan nama duplikat ditolak", async () => {
    const name = `Peran Duplikat ${Date.now()}`;
    await createRole(admin, { name });
    await expect(createRole(admin, { name })).rejects.toBeInstanceOf(ConflictError);
  });

  it("9. assignUserRole menetapkan peran ke pengguna", async () => {
    const username = `role.user.${Date.now()}`;
    const created = await createUser(admin, { username, fullName: "Role Pengguna", password: "Role@2026" });
    const roles = await listRoles(admin);
    const kasir = roles.find((r) => r.code === "KASIR")!;
    await assignUserRole(admin, created.id, [kasir.id]);
    const user = (await listUsers(admin)).find((u) => u.username === username);
    expect(user?.roles).toContain(kasir.name);
  });

  it("10. assignRolePermissions menetapkan permission ke peran", async () => {
    const role = await createRole(admin, { name: `Peran Perm ${Date.now()}` });
    const perms = await listPermissions(admin);
    const target = perms.filter((p) => ["patients.view", "billing.view"].includes(p.code)).map((p) => p.id);
    await assignRolePermissions(admin, role.id, target);
    const assigned = (await getRolePermissions(admin, role.id)).map((p) => p.permissionId).sort();
    expect(assigned).toEqual(target.sort());
  });

  it("11. getRolePermissions untuk peran tanpa permission mengembalikan kosong", async () => {
    const role = await createRole(admin, { name: `Peran Kosong ${Date.now()}` });
    expect(await getRolePermissions(admin, role.id)).toHaveLength(0);
  });

  it("12. listUsers menyertakan status aktif", async () => {
    const users = await listUsers(admin);
    expect(users.length).toBeGreaterThanOrEqual(10);
    expect(users.every((u) => typeof u.isActive === "boolean")).toBe(true);
  });
});
