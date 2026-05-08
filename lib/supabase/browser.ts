"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for use in client components. Carries the user's
 * session cookies; queries it makes are subject to RLS.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
