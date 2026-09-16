export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === undefined) {
    console.log("[instrumentation] DATABASE_URL?", Boolean(process.env.DATABASE_URL), "DB_DRIVER:", process.env.DB_DRIVER ?? "<unset>");
    const { resolveDriver, ensureLocalSchema } = await import("@/db");
    const driver = resolveDriver();
    if (driver === "pglite") {
      await ensureLocalSchema();
      if (process.env.NODE_ENV === "development") {
        const { bootstrapSeed } = await import("@/db/seed");
        await bootstrapSeed();
      }
    }
  }
}