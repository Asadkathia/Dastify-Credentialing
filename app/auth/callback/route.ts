import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";

/**
 * Magic-link landing route. Supabase appends a `code` query param; we exchange
 * it for a session cookie and then redirect to the role-appropriate landing.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  // Defer to middleware to route the user to /admin or /portal.
  return NextResponse.redirect(new URL(next, request.url));
}
