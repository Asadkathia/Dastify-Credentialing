import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  ACTIVITY_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
  checkSessionExpiry,
  parseActivityCookie,
  parseLastSignInAt,
  type SessionExpiryReason,
} from "@/lib/auth/session-policy";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware refreshes the Supabase auth session cookie on each request and
 * gates route groups:
 *   /admin/*  → admin only
 *   /portal/* → org_admin / org_viewer only
 *   /login    → public
 *
 * Role is read from the JWT's `app_metadata.app_role` claim, populated by the
 * `public.custom_access_token_hook` Postgres function (migration 0013). If the
 * claim is absent (hook not enabled yet, or a session predating the hook), we
 * fall back to two parallel Supabase lookups so the gate still works.
 *
 * This is a coarse first gate; finer authorization happens in server components
 * via `requireAdmin()` / `requireOrganization()` and at the DB layer via RLS.
 */

const PUBLIC_PATHS = new Set([
  "/login",
  "/auth/callback",
  "/auth/error",
  "/forgot-password",
  "/reset-password",
]);

type AppRole = "admin" | "org_admin" | "org_viewer";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Public paths, internal asset paths, and external callback endpoints that
  // authenticate via their own signature (not a session cookie): skip auth.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/auth/send-email")
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → push to login.
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Session-expiry enforcement: idle (30 min, cookie-tracked) and absolute
  // (12 h since last_sign_in_at). See lib/auth/session-policy.ts for rationale.
  const now = Date.now();
  const lastActivityAt = parseActivityCookie(
    request.cookies.get(ACTIVITY_COOKIE_NAME)?.value,
  );
  const lastSignInAt = parseLastSignInAt(user.last_sign_in_at);
  const expiryReason: SessionExpiryReason | null = checkSessionExpiry({
    now,
    lastActivityAt,
    lastSignInAt,
  });
  if (expiryReason) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", expiryReason);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    const out = NextResponse.redirect(loginUrl);
    out.cookies.delete(ACTIVITY_COOKIE_NAME);
    return out;
  }

  response.cookies.set(ACTIVITY_COOKIE_NAME, String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(SESSION_IDLE_TIMEOUT_MS / 1000),
  });

  // Fast path: role is stamped into the JWT by the access-token hook.
  let role: AppRole | null =
    (user.app_metadata as { app_role?: AppRole } | undefined)?.app_role ?? null;

  // Fallback path: claim missing (hook not enabled / stale session). Probe
  // both tables in parallel and infer the role.
  if (!role) {
    const [{ data: adminRow }, { data: orgRow }] = await Promise.all([
      supabase.from("admin_users").select("is_active").eq("id", user.id).maybeSingle(),
      supabase.from("organization_users").select("is_active, role").eq("id", user.id).maybeSingle(),
    ]);
    if (adminRow?.is_active === true) {
      role = "admin";
    } else if (orgRow?.is_active === true) {
      role = orgRow.role as AppRole;
    }
  }

  const isAdmin = role === "admin";
  const isOrgUser = role === "org_admin" || role === "org_viewer";

  // Orphaned auth session (user exists in auth.users but no app row) → log out.
  if (!isAdmin && !isOrgUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no_profile", request.url));
  }

  // Admin can only enter /admin/*
  if (pathname.startsWith("/admin")) {
    if (!isAdmin) return NextResponse.redirect(new URL("/portal", request.url));
    return response;
  }

  // Org users can only enter /portal/*
  if (pathname.startsWith("/portal")) {
    if (!isOrgUser) return NextResponse.redirect(new URL("/admin", request.url));
    return response;
  }

  // Root → role-appropriate landing.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/portal", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
