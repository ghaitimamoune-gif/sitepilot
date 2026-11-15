import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: {
      TZ: "Africa/Casablanca",
      // Les tests d'intégration utilisent une base dédiée, vidée à chaque exécution.
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "postgres://eb:eb@localhost:5432/easyburger_test",
      DATA_DIR: path.join(os.tmpdir(), "easyburger-tests"),
      APP_SECRET: "secret-des-tests-uniquement-0123456789",
    },
  },
});
