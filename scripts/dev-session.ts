import { ensureLocalSchema, getDb } from "../db";
import { sessions, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "../lib/auth/session";

const username = process.argv[2] ?? "admin";

async function main() {
  await ensureLocalSchema();
  const db = getDb();
  const user = await db.select({ id: users.id, organizationId: users.organizationId, branchId: users.branchId }).from(users).where(eq(users.username, username)).limit(1);
  if (user.length === 0) throw new Error(`User ${username} not found. Run db:seed first.`);
  await db.delete(sessions).where(eq(sessions.userId, user[0].id));
  const token = await createSession(user[0].id, user[0].organizationId, user[0].branchId);
  console.log(token);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});