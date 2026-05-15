import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factories for RLS integration tests.
 *
 *   - adminClient(): service-role key, bypasses RLS. Use for seed + cleanup.
 *   - anonClient():  anon key with no session. Use to assert "logged-out
 *     attacker" denial paths.
 *   - userClient(): anon key + a specific user's access token. RLS applies as
 *     that user. This is the standard way every test "logs in" as admin /
 *     org_admin / org_viewer.
 *
 * All clients read SUPABASE_URL / SUPABASE_*_KEY from process.env — populated
 * by global-setup.ts before any test runs.
 */

function url() {
  const u = process.env.SUPABASE_URL;
  if (!u) throw new Error("SUPABASE_URL not set; global-setup did not run.");
  return u;
}

function anonKey() {
  const k = process.env.SUPABASE_ANON_KEY;
  if (!k) throw new Error("SUPABASE_ANON_KEY not set; global-setup did not run.");
  return k;
}

function serviceKey() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set; global-setup did not run.");
  return k;
}

export function adminClient(): SupabaseClient {
  return createClient(url(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
