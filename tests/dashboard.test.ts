import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { loginWithPassword } from "@/lib/auth/login";
import { getDashboardStats } from "@/features/dashboard/queries";

beforeAll(async () => {
  await initDb();
}, 120000);

describe("dashboard analytics", () => {
  it("returns seeded stats for an admin", async () => {
    const user = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
    const stats = await getDashboardStats(user);
    expect(stats.totalPatients).toBe(4);
    expect(typeof stats.todayVisits).toBe("number");
    expect(typeof stats.todayAppointments).toBe("number");
    expect(typeof stats.todayRevenue).toBe("number");
    expect(typeof stats.outstandingInvoices).toBe("number");
    expect(typeof stats.lowStock).toBe("number");
    expect(Array.isArray(stats.recentActivity)).toBe(true);
  });

  it("keeps analytics scoped to the organization", async () => {
    const user = (await loginWithPassword("pharmacist", "Pharmacist@2026")).sessionUser;
    const stats = await getDashboardStats(user);
    expect(stats.totalPatients).toBe(4);
  });
});