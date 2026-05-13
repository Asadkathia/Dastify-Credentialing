import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  role: "admin";
  userId: string;
  email: string;
  fullName: string;
};

export type ClientSession = {
  role: "client_admin" | "client_viewer";
  userId: string;
  email: string;
  fullName: string;
  clientId: string;
};

export type Session = AdminSession | ClientSession;

/**
 * Reads the current Supabase auth session and resolves it to either an
 * AdminSession (if the user is in admin_users) or a ClientSession (if in
 * client_users), or null. Cached per request via React's `cache()`.
 *
 * This is the single source of truth for "who is the current user" in any
 * server component or server action.
 */
export const getCurrentSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // The JWT custom access token hook (migration 0012) stamps `app_role` and
  // `client_id` into app_metadata, so we know which side to query without a
  // probe. If claims are missing (hook disabled / pre-hook session), fall back
  // to looking in both tables in parallel.
  const appRole = (user.app_metadata as { app_role?: string } | undefined)?.app_role;

  if (appRole === "admin") {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, email, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (adminRow && adminRow.is_active) {
      return {
        role: "admin",
        userId: adminRow.id,
        email: adminRow.email,
        fullName: adminRow.full_name,
      };
    }
    return null;
  }

  if (appRole === "client_admin" || appRole === "client_viewer") {
    const { data: clientRow } = await supabase
      .from("client_users")
      .select("id, email, full_name, role, client_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (clientRow && clientRow.is_active) {
      return {
        role: clientRow.role as "client_admin" | "client_viewer",
        userId: clientRow.id,
        email: clientRow.email,
        fullName: clientRow.full_name,
        clientId: clientRow.client_id,
      };
    }
    return null;
  }

  // Fallback path — JWT claim absent. Probe both tables in parallel rather
  // than serially.
  const [{ data: adminRow }, { data: clientRow }] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, email, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("client_users")
      .select("id, email, full_name, role, client_id, is_active")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (adminRow && adminRow.is_active) {
    return {
      role: "admin",
      userId: adminRow.id,
      email: adminRow.email,
      fullName: adminRow.full_name,
    };
  }

  if (clientRow && clientRow.is_active) {
    return {
      role: clientRow.role as "client_admin" | "client_viewer",
      userId: clientRow.id,
      email: clientRow.email,
      fullName: clientRow.full_name,
      clientId: clientRow.client_id,
    };
  }

  return null;
});

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getCurrentSession();
  if (!session || session.role !== "admin") {
    throw new Error("Unauthorized: admin role required");
  }
  return session;
}

export async function requireClient(): Promise<ClientSession> {
  const session = await getCurrentSession();
  if (!session || session.role === "admin") {
    throw new Error("Unauthorized: client role required");
  }
  return session;
}

export async function requireSession(): Promise<Session> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
