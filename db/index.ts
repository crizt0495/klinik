import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import * as schema from "./schema";

export type Driver = "neon-http" | "pglite";
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

let neonClient: ReturnType<typeof neon> | null = null;
let neonDb: DB | null = null;
let pgDb: DB | null = null;
let pgInstance: PGlite | null = null;

const PG_DB_GLOBAL_KEY = Symbol.for("klinik.pgDb");
const PG_INSTANCE_GLOBAL_KEY = Symbol.for("klinik.pgInstance");

type GlobalWithPg = typeof globalThis & {
  [PG_DB_GLOBAL_KEY]?: DB;
  [PG_INSTANCE_GLOBAL_KEY]?: PGlite;
};

function globalPgDb(): DB | null {
  return (globalThis as GlobalWithPg)[PG_DB_GLOBAL_KEY] ?? null;
}

function globalPgInstance(): PGlite | null {
  return (globalThis as GlobalWithPg)[PG_INSTANCE_GLOBAL_KEY] ?? null;
}

export function resolveDriver(): Driver {
  if (process.env.DB_DRIVER === "pglite" && process.env.NODE_ENV !== "production") return "pglite";
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") return "pglite";
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured (production requires a PostgreSQL URL)");
  return "neon-http";
}

export function getConnectionString(): string {
  return process.env.DATABASE_URL ?? "";
}

export function getDb() {
  const driver = resolveDriver();
  if (driver === "pglite") {
    if (pgDb) return pgDb;
    const g = globalPgDb();
    if (g) {
      pgDb = g;
      return g;
    }
    throw new Error("PGlite database is not initialized. Call initLocalDb() first.");
  }
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (neonDb) return neonDb;
  neonClient = neon(connectionString, { arrayMode: false });
  neonDb = drizzle(neonClient, { schema }) as DB;
  return neonDb;
}

let initPromise: Promise<PGlite> | null = null;
const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? ".pglite";
export async function initLocalDb(): Promise<PGlite> {
  if (pgInstance) return pgInstance;
  const g = globalPgInstance();
  if (g) {
    pgInstance = g;
    return g;
  }
  if (!initPromise) {
    initPromise = (async () => {
      const instance = new PGlite({ dataDir: PGLITE_DATA_DIR });
      await instance.waitReady;
      pgInstance = instance;
      pgDb = drizzlePglite(instance, { schema }) as DB;
      (globalThis as GlobalWithPg)[PG_INSTANCE_GLOBAL_KEY] = instance;
      (globalThis as GlobalWithPg)[PG_DB_GLOBAL_KEY] = pgDb;
      return instance;
    })();
  }
  return initPromise;
}

export async function ensureLocalSchema(): Promise<void> {
  await initLocalDb();
  const migrationsFolder = join(process.cwd(), "db", "migrations");
  await applyLocalMigrations(migrationsFolder);
}

export async function applyLocalMigrations(migrationsFolder: string) {
  const instance = await initLocalDb();
  if (!pgDb) throw new Error("PGlite not initialized");
  await migratePgliteFallback(instance, migrationsFolder);
  return pgDb;
}

interface LocalMigration {
  tag: string;
  fileName: string;
  when: number;
  hash: string;
}

async function migratePgliteFallback(instance: PGlite, migrationsFolder: string): Promise<void> {
  await instance.exec(`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);

  const metaDir = join(migrationsFolder, "meta");
  const journalPath = join(metaDir, "_journal.json");
  if (!existsSync(journalPath)) return;

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
  const migrations: LocalMigration[] = journal.entries.map((entry) => {
    const fileName = `${entry.tag}.sql`;
    const filePath = join(migrationsFolder, fileName);
    const sql = readFileSync(filePath, "utf8");
    return { tag: entry.tag, fileName, when: entry.when, hash: createHash("sha256").update(sql.replace(/\s+/g, " ")).digest("hex") };
  });

  const result = await instance.query(`SELECT hash FROM "__drizzle_migrations"`);
  const applied = new Set((result.rows as Array<{ hash: string }>).map((r) => r.hash));

  for (const migration of migrations) {
    if (applied.has(migration.hash)) continue;
    const sql = readFileSync(join(migrationsFolder, migration.fileName), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await instance.transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.exec(stmt);
      }
      await tx.exec(`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES ('${migration.hash}', ${migration.when})`);
    });
  }
}

export const db = getDb;
export { schema };