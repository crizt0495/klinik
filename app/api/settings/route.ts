import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { settingsService } from "@/lib/services/settings";

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user.isSuperAdmin && !user.permissions.has("settings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    await db().update(s.organizations).set({
      name: body.organizationName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      updatedAt: new Date(),
    }).where(eq(s.organizations.id, user.organizationId));
    if (body.website !== undefined) {
      await settingsService.upsert(user.organizationId, null, "website", body.website ?? null);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}