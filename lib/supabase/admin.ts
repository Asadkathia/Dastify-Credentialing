import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES RLS. Use ONLY for:
 *   - admin invitation flows (creating auth users via supabase.auth.admin.*)
 *   - background jobs (Inngest)
 *   - server-side seeding
 *
 * Never expose this to the browser. Never use this for ordinary user-scoped
 * queries — use `createSupabaseServerClient` instead, which preserves RLS.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase URL or service role key is missing");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
