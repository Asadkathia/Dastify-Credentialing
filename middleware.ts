import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware refreshes the Supabase auth session cookie on each request and
 * gates route groups:
 *   /admin/*  → admin only
 *   /portal/* → client_admin / client_viewer only
 *   /login    → public
 *
 * This is a coarse first gate; finer authorization happens in server components
 * via `requireAdmin()` / `requireClient()` and at the DB layer via RLS.
 */

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/auth/error"]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  const { pathname } = request.nextUrl;

  // Public paths: never redirect.
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api/health")) {
    return response;
  }

  // Not authenticated → push to login.
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Coarse role gate: hit the appropriate auth tables to decide which area.
  // This adds one DB query per protected request, which is fine for v1; cache
  // via cookie metadata if it shows up in profiling.
  const [{ data: adminRow }, { data: clientRow }] = await Promise.all([
    supabase.from("admin_users").select("is_active").eq("id", user.id).maybeSingle(),
    supabase.from("client_users").select("is_active, role").eq("id", user.id).maybeSingle(),
  ]);

  const isAdmin = adminRow?.is_active === true;
  const isClient = clientRow?.is_active === true;

  // Orphaned auth session (user exists in auth.users but no app row) → log out.
  if (!isAdmin && !isClient) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no_profile", request.url));
  }

  // Admin can only enter /admin/*
  if (pathname.startsWith("/admin")) {
    if (!isAdmin) return NextResponse.redirect(new URL("/portal", request.url));
    return response;
  }

  // Client can only enter /portal/*
  if (pathname.startsWith("/portal")) {
    if (!isClient) return NextResponse.redirect(new URL("/admin", request.url));
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
