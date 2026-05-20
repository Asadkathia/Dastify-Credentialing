import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Verify a user's password without disturbing their live session.
 *
 * Uses an ephemeral, cookie-less Supabase client so a wrong guess never rotates
 * (or clears) the caller's real session cookies. Returns true iff the
 * credentials are valid. Used as a step-up check before sensitive actions
 * (password change, permanent/destructive deletes).
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
