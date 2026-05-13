import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  role: "admin";
  userId: string;
  email: string;
  fullName: string;
};

export type OrganizationSession = {
  role: "org_admin" | "org_viewer";
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
};

export type Session = AdminSession | OrganizationSession;

/**
 * Reads the current Supabase auth session and resolves it to either an
 * AdminSession (if the user is in admin_users) or an OrganizationSession
 * (if in organization_users), or null. Cached per request via React's `cache()`.
 *
 * Source of truth for "who is the current user" in any server component or
 * server action.
 */
export const getCurrentSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // The JWT custom access token hook (migration 0013, replacing 0012) stamps
  // `app_role` and `organization_id` into app_metadata. If claims are missing
  // (hook disabled / pre-rename session), fall back to looking in both tables.
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

  if (appRole === "org_admin" || appRole === "org_viewer") {
    const { data: orgRow } = await supabase
      .from("organization_users")
      .select("id, email, full_name, role, organization_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (orgRow && orgRow.is_active) {
      return {
        role: orgRow.role as "org_admin" | "org_viewer",
        userId: orgRow.id,
        email: orgRow.email,
        fullName: orgRow.full_name,
        organizationId: orgRow.organization_id,
      };
    }
    return null;
  }

  // Fallback path — JWT claim absent. Probe both tables in parallel rather
  // than serially.
  const [{ data: adminRow }, { data: orgRow }] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, email, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_users")
      .select("id, email, full_name, role, organization_id, is_active")
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

  if (orgRow && orgRow.is_active) {
    return {
      role: orgRow.role as "org_admin" | "org_viewer",
      userId: orgRow.id,
      email: orgRow.email,
      fullName: orgRow.full_name,
      organizationId: orgRow.organization_id,
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

export async function requireOrganization(): Promise<OrganizationSession> {
  const session = await getCurrentSession();
  if (!session || session.role === "admin") {
    throw new Error("Unauthorized: organization role required");
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
