import { execFileSync, spawnSync } from "node:child_process";

/**
 * Vitest globalSetup for RLS integration tests.
 *
 * Boots (or reuses) a local Supabase stack via the Supabase CLI, then applies
 * every migration in db/migrations/ using the project's own runner so the
 * schema matches production.
 *
 * Requirements (one-time, per machine):
 *   1. Docker Desktop running.
 *   2. Supabase CLI installed: `brew install supabase/tap/supabase`.
 *
 * Subsequent runs reuse the running stack — boot is amortized.
 */
export default async function setup() {
  ensureSupabaseRunning();
  const status = readSupabaseStatus();
  exportEnv(status);
  applyMigrations(status.dbUrl);
}

type SupabaseStatus = {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function ensureSupabaseRunning() {
  const probe = spawnSync("supabase", ["status"], { encoding: "utf8" });
  if (probe.status === 0) return;

  if (probe.error && (probe.error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new Error(
      "Supabase CLI not found. Install with: brew install supabase/tap/supabase",
    );
  }

  console.log("[integration] starting local Supabase stack ...");
  const start = spawnSync("supabase", ["start"], {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (start.status !== 0) {
    throw new Error(
      `supabase start failed (exit ${start.status}). Is Docker running?`,
    );
  }
}

function readSupabaseStatus(): SupabaseStatus {
  const out = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
  });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && m[1] !== undefined && m[2] !== undefined) env[m[1]] = m[2];
  }
  const apiUrl = env.API_URL;
  const dbUrl = env.DB_URL;
  const anonKey = env.ANON_KEY;
  const serviceRoleKey = env.SERVICE_ROLE_KEY;
  if (!apiUrl || !dbUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      `Could not parse supabase status output. Got keys: ${Object.keys(env).join(", ")}`,
    );
  }
  return { apiUrl, dbUrl, anonKey, serviceRoleKey };
}

function exportEnv({ apiUrl, dbUrl, anonKey, serviceRoleKey }: SupabaseStatus) {
  process.env.SUPABASE_URL = apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_URL = apiUrl;
  process.env.SUPABASE_ANON_KEY = anonKey;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.DATABASE_URL = dbUrl;
}

function applyMigrations(dbUrl: string) {
  console.log("[integration] applying migrations ...");
  const result = spawnSync("pnpm", ["exec", "tsx", "db/migrate.ts"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  if (result.status !== 0) {
    throw new Error(`db:migrate failed (exit ${result.status})`);
  }
}
