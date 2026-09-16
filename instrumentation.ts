export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === undefined) {
    console.log("[inst] DB?", Boolean(process.env.DATABASE_URL), "| eDB?", Boolean(process.env.INJ_DATABASE_URL), "| probe?", process.env.INJ_PROBE ?? "<none>", "| vurl?", process.env.VERCEL_URL ?? "<none>", "| appurl?", process.env.NEXT_PUBLIC_APP_URL ?? "<none>");
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