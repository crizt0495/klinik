import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "./helpers/db";
import { loginWithPassword } from "@/lib/auth/login";
import { nextSequence, generateBusinessNumber, nextQueueNumber, datePeriod, buildNumber } from "@/lib/services/numbering";

beforeAll(async () => {
  await initDb();
}, 120000);

describe("numbering", () => {
  it("increments atomically per scope", async () => {
    const user = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
    const org = user.organizationId;
    const branch = user.branchId ?? null;

    const a1 = await nextSequence(org, branch, "TEST", "p1");
    const a2 = await nextSequence(org, branch, "TEST", "p1");
    expect(a2).toBe(a1 + 1);

    const b1 = await nextSequence(org, branch, "TEST", "p2");
    expect(b1).toBe(1);
  });

  it("builds business numbers with period", async () => {
    const user = (await loginWithPassword("admin", "Admin@2026")).sessionUser;
    const org = user.organizationId;
    const branch = user.branchId ?? null;

    const nr = await generateBusinessNumber({ organizationId: org, branchId: branch, prefix: "MR", scope: "MRN", period: datePeriod(), width: 6 });
    expect(nr).toMatch(/^MR-\d{8}-\d{6}$/);
  });

  it("allocates queue numbers per department per day", async () => {
    const user = (await loginWithPassword("receptionist", "Receptionist@2026")).sessionUser;
    const org = user.organizationId;
    const branch = user.branchId ?? null;
    const dept = "11111111-1111-1111-1111-111111111111";

    const q1 = await nextQueueNumber(org, branch, dept, "2026-09-15");
    const q2 = await nextQueueNumber(org, branch, dept, "2026-09-15");
    expect(q2).toBe(q1 + 1);
    const q3 = await nextQueueNumber(org, branch, dept, "2026-09-16");
    expect(q3).toBe(1);
  });

  it("formats numbers with padding", () => {
    expect(buildNumber("INV", "20260915", 42, 6)).toBe("INV-20260915-000042");
  });
});