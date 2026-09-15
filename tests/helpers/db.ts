import { rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import { ensureLocalSchema } from "@/db";
import { runSeed } from "@/db/seed";

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), ".pglite-test");

let ready: Promise<void> | null = null;

/**
 * Initializes the isolated PGlite test database (fresh schema + seed).
 * Safe to call from multiple test files in the same worker.
 */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    rmSync(DATA_DIR, { recursive: true, force: true });
    mkdirSync(DATA_DIR, { recursive: true });
    await ensureLocalSchema();
    await runSeed();
  })();
  return ready;
}

export { DATA_DIR };