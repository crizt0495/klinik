import { runSeed } from "../db/seed";
import { resolveDriver } from "../db";

(async () => {
  const driver = resolveDriver();
  await runSeed();
  console.log("Seed selesai. DB_DRIVER=" + driver);
  process.exit(0);
})().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});