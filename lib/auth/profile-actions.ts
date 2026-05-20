"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSession, type Session } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/reauth";
import {
  updateProfileNameSchema,
  changeEmailSchema,
  changePasswordSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

/** Which identity table backs this session's profile row. */
function identityTable(session: Session): "admin_users" | "organization_users" {
  return session.role === "admin" ? "admin_users" : "organization_users";
}

function orgIdFor(session: Session): string | null {
  return session.role === "admin" ? null : session.organizationId;
}

/**
 * Update the current user's display name in their identity table
 * (admin_users / organization_users) — the source of truth the UI reads from.
 */
export async function updateProfileName(
  formData: FormData,
): Promise<ActionResult<{ fullName: string }>> {
  const session = await requireSession();
  const parsed = updateProfileNameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) {
    return fail("Please enter your name.", parsed.error.flatten().fieldErrors);
  }
  const fullName = parsed.data.fullName;
  if (fullName === session.fullName) return ok({ fullName });

  const admin = createSupabaseAdminClient();
  const table = identityTable(session);
  const { error } = await admin.from(table).update({ full_name: fullName }).eq("id", session.userId);
  if (error) return fail("Could not update your name. Please try again.");

  await admin.from("activity_events").insert({
    organization_id: orgIdFor(session),
    actor_user_id: session.userId,
    action: "update",
    target_table: table,
    target_id: session.userId,
    summary: "Updated profile name",
    diff: { full_name: { from: session.fullName, to: fullName } },
  });

  revalidatePath("/admin/profile");
  revalidatePath("/portal/profile");
  return ok({ fullName });
}

/**
 * Begin an email change. Supabase sends confirmation links (to the new address,
 * and to the old one when Secure Email Change is on) routed through our Graph
 * Send Email Hook. auth.users.email is not updated until confirmed; the
 * denormalized copy in the identity table is mirrored in /auth/callback once
 * the change lands. No password reauth here — the double-inbox confirmation is
 * the anti-hijack control, and it doesn't lock out magic-link-only users.
 */
export async function changeEmail(
  formData: FormData,
): Promise<ActionResult<{ pending: true; newEmail: string }>> {
  const session = await requireSession();
  const parsed = changeEmailSchema.safeParse({ newEmail: formData.get("newEmail") });
  if (!parsed.success) {
    return fail("Please enter a valid email address.", parsed.error.flatten().fieldErrors);
  }
  const newEmail = parsed.data.newEmail;
  if (newEmail === session.email.toLowerCase()) {
    return fail("That is already your email address.");
  }

  const h = await headers();
  const origin =
    h.get("origin") ?? (h.get("referer") ? new URL(h.get("referer")!).origin : null);
  if (!origin) return fail("Could not determine request origin.");
  const next = session.role === "admin" ? "/admin/profile" : "/portal/profile";
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo });
  if (error) return fail(error.message);

  const admin = createSupabaseAdminClient();
  await admin.from("activity_events").insert({
    organization_id: orgIdFor(session),
    actor_user_id: session.userId,
    action: "update",
    target_table: identityTable(session),
    target_id: session.userId,
    summary: "Requested email change",
    diff: { email: { from: session.email, to: newEmail } },
  });

  return ok({ pending: true, newEmail });
}

/**
 * Change the current user's password. Reauthenticates with the current password
 * first (HIPAA-aligned defense against a hijacked session silently rotating the
 * password), then updates and signs out all OTHER sessions.
 */
export async function changePassword(
  formData: FormData,
): Promise<ActionResult<{ changed: true }>> {
  const session = await requireSession();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return fail("Please check the password fields.", parsed.error.flatten().fieldErrors);
  }

  const valid = await verifyPassword(session.email, parsed.data.currentPassword);
  if (!valid) {
    return fail(
      "Current password is incorrect. If you sign in with a magic link, use Forgot Password to set one.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updErr) return fail(updErr.message);

  await supabase.auth.signOut({ scope: "others" });

  const admin = createSupabaseAdminClient();
  await admin.from("activity_events").insert({
    organization_id: orgIdFor(session),
    actor_user_id: session.userId,
    action: "update",
    target_table: identityTable(session),
    target_id: session.userId,
    summary: "Changed password",
  });

  return ok({ changed: true });
}
