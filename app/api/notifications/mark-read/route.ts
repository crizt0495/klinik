import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    if (body.markAll) {
      await db().update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)));
    } else if (body.id) {
      await db().update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.id, body.id), eq(s.notifications.userId, user.id)));
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}