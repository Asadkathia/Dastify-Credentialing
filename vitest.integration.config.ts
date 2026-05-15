import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration test config — runs RLS isolation tests against a local Supabase
// stack. Separate from vitest.config.ts so `pnpm test` stays fast and DB-free.
//
// See tests/integration/README.md for the one-time setup (Docker + Supabase
// CLI) and the run workflow.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e", "tests/unit"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
});
