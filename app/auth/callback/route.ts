import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/auth/safe-next";

/**
 * Magic-link landing route. Supabase appends a `code` query param; we exchange
 * it for a session cookie and then redirect to the role-appropriate landing.
 *
 * Also the landing point for a confirmed email change: once auth.users.email
 * flips, mirror it into the denormalized copy in the identity tables so the app
 * doesn't drift from the auth record. Idempotent — a no-op on ordinary logins.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) {
    const admin = createSupabaseAdminClient();
    await Promise.all([
      admin.from("admin_users").update({ email: user.email }).eq("id", user.id).neq("email", user.email),
      admin
        .from("organization_users")
        .update({ email: user.email })
        .eq("id", user.id)
        .neq("email", user.email),
    ]);
  }

  // Defer to middleware to route the user to /admin or /portal.
  return NextResponse.redirect(new URL(next, request.url));
}
