import "server-only";
import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client that carries the user's auth cookies, so all
 * queries it makes are subject to RLS as that user. Use this from server
 * components, server actions, and route handlers for any user-scoped query.
 *
 * Wrapped in React `cache()` so layouts, pages, and child server components in
 * the same render share one client (and one cookie-store read) per request.
 */
export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Setting cookies during a server component render is not allowed;
            // middleware refreshes the session, so this catch is fine.
          }
        },
      },
    },
  );
});
