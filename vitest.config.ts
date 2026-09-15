import { defineConfig } from "vitest/config";
import { resolve, join } from "path";
import { tmpdir } from "os";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 90000,
    fileParallelism: false,
    env: {
      DB_DRIVER: "pglite",
      PGLITE_DATA_DIR: join(tmpdir(), "klinik-pglite-vitest"),
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@db": resolve(__dirname, "db"),
    },
  },
});