import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { settingsService } from "@/lib/services/settings";

const settingsSchema = z.object({
  organizationName: z.string().min(1).max(200),
  address: z.string().max(300).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
});

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user.isSuperAdmin && !user.permissions.has("settings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid", details: z.flattenError(parsed.error) }, { status: 422 });
    }
    const data = parsed.data;
    await db().update(s.organizations).set({
      name: data.organizationName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      updatedAt: new Date(),
    }).where(eq(s.organizations.id, user.organizationId));
    if (data.website !== undefined) {
      await settingsService.upsert(user.organizationId, null, "website", data.website ?? null);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}