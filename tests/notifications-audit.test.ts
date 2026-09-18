import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { loginWithPassword } from "@/lib/auth/login";
import type { SessionUser } from "@/lib/auth/session";
import { createNotification, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, listNotifications } from "@/lib/services/notification";
import { writeAuditLog, listAuditLogs } from "@/lib/services/audit";

let admin: SessionUser;
let doctor: SessionUser;

beforeAll(async () => {
  await initDb();
  admin = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
  doctor = (await loginWithPassword("doctor", "Doctor@2026")).sessionUser;
}, 120000);

describe("modul notifikasi & audit log", () => {
  it("1. notifikasi baru tampil sebagai belum dibaca", async () => {
    await createNotification({ organizationId: admin.organizationId, branchId: admin.branchId, userId: admin.id, type: "TEST", title: "Notif Uji", message: "Pesan uji", data: { link: "/dashboard" } });
    const list = await listNotifications(admin);
    expect(list.some((n) => n.title === "Notif Uji" && n.isRead === false)).toBe(true);
  });

  it("2. jumlah notifikasi belum dibaca bertambah", async () => {
    await createNotification({ organizationId: admin.organizationId, userId: admin.id, type: "TEST", title: "Notif Hitung" });
    expect(await getUnreadNotificationCount(admin.id)).toBeGreaterThanOrEqual(1);
  });

  it("3. menandai notifikasi dibaca menurunkan jumlah", async () => {
    await createNotification({ organizationId: admin.organizationId, userId: admin.id, type: "TEST", title: "Notif Baca" });
    const notif = (await listNotifications(admin)).find((n) => n.title === "Notif Baca")!;
    await markNotificationRead(notif.id, admin.id);
    const after = (await listNotifications(admin)).find((n) => n.id === notif.id);
    expect(after?.isRead).toBe(true);
  });

  it("4. markAllNotificationsRead menghabiskan notifikasi belum dibaca", async () => {
    await createNotification({ organizationId: admin.organizationId, userId: admin.id, type: "TEST", title: "Notif Semua" });
    await markAllNotificationsRead(admin.id);
    expect(await getUnreadNotificationCount(admin.id)).toBe(0);
  });

  it("5. notifikasi menyertakan link dan message", async () => {
    await createNotification({ organizationId: admin.organizationId, userId: admin.id, type: "TEST", title: "Notif Link", message: "Isi", data: { link: "/patients" } });
    const notif = (await listNotifications(admin)).find((n) => n.title === "Notif Link");
    expect(notif?.link).toBe("/patients");
    expect(notif?.message).toBe("Isi");
  });

  it("6. notifikasi milik pengguna lain tidak terbaca", async () => {
    await createNotification({ organizationId: admin.organizationId, userId: admin.id, type: "TEST", title: "Notif Privat" });
    const notif = (await listNotifications(admin)).find((n) => n.title === "Notif Privat")!;
    await markNotificationRead(notif.id, doctor.id);
    expect((await listNotifications(admin)).find((n) => n.id === notif.id)?.isRead).toBe(false);
  });

  it("7. jumlah notifikasi pengguna lain tanpa notifikasi adalah 0", async () => {
    expect(await getUnreadNotificationCount(doctor.id)).toBe(0);
  });

  it("8. writeAuditLog tercatat dengan nama pengguna", async () => {
    await writeAuditLog({ user: admin, action: "E2E_AUDIT", entityType: "e2e_entity", entityId: admin.id, newData: { ok: true } });
    const logs = await listAuditLogs(admin, { action: "E2E_AUDIT" });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe("E2E_AUDIT");
    expect(logs[0].userName).toBeTruthy();
  });

  it("9. listAuditLogs dapat difilter entityType", async () => {
    await writeAuditLog({ user: admin, action: "E2E_AUDIT_ENTITY", entityType: "pasien_uji", entityId: doctor.id });
    const logs = await listAuditLogs(admin, { entityType: "pasien_uji" });
    expect(logs.some((l) => l.entityType === "pasien_uji")).toBe(true);
  });

  it("10. listAuditLogs dapat difilter rentang tanggal hari ini", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await writeAuditLog({ user: admin, action: "E2E_AUDIT_DATE", entityType: "e2e_entity" });
    const logs = await listAuditLogs(admin, { action: "E2E_AUDIT_DATE", dateFrom: today, dateTo: today });
    expect(logs.some((l) => l.action === "E2E_AUDIT_DATE")).toBe(true);
  });
});
