import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import type { PgTransactionConfig } from "drizzle-orm/pg-core";
import { getConnectionString, resolveDriver, initLocalDb, db, schema, type DB } from "@/db";

let txPool: NeonDatabase<typeof schema> | null = null;

function getTxDb(): NeonDatabase<typeof schema> {
  if (!txPool) {
    const pool = new Pool({ connectionString: getConnectionString() });
    txPool = drizzle(pool, { schema });
  }
  return txPool;
}

/**
 * Menjalankan callback di dalam transaksi database (ACID).
 * - Produksi (Neon): koneksi WebSocket pool (mendukung transaksi interaktif).
 * - Lokal/test (PGlite): transaksi native.
 *
 * Semua operasi di dalam callback dijalankan pada koneksi transaksional yang sama,
 * sehingga read → check → write aman dari race condition antar permintaan.
 */
export async function runInTransaction<T>(fn: (tx: DB) => Promise<T>, config?: PgTransactionConfig): Promise<T> {
  if (resolveDriver() === "pglite") {
    await initLocalDb();
    const pgDb = db();
    return pgDb.transaction(async (tx) => fn(tx as unknown as DB), config);
  }
  return getTxDb().transaction(async (tx) => fn(tx as unknown as DB), config);
}