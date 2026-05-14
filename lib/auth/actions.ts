"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requestPasswordResetSchema,
  completePasswordResetSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Step 1 of the forgot-password flow: send a recovery email.
 *
 * Always returns `ok({ sent: true })` to avoid leaking which emails are
 * registered (account enumeration). Internally:
 *   - Triggers Supabase's recovery mailer for the address.
 *   - If the address maps to a real admin or org user, writes a
 *     `password_reset_requested` audit row with the resolved user_id.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fail("Please enter a valid email address.", parsed.error.flatten().fieldErrors);
  }
  const email = parsed.data.email;

  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("referer") ? new URL(h.get("referer")!).origin : null);
  if (!origin) {
    return fail("Could not determine request origin.");
  }
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  const admin = createSupabaseAdminClient();
  const [{ data: adminRow }, { data: orgRow }] = await Promise.all([
    admin.from("admin_users").select("id").eq("email", email).maybeSingle(),
    admin
      .from("organization_users")
      .select("id, organization_id")
      .eq("email", email)
      .maybeSingle(),
  ]);

  const actorUserId = adminRow?.id ?? orgRow?.id ?? null;
  if (actorUserId) {
    await admin.from("activity_events").insert({
      organization_id: orgRow?.organization_id ?? null,
      actor_user_id: actorUserId,
      action: "password_reset_requested",
      target_table: adminRow ? "admin_users" : "organization_users",
      target_id: actorUserId,
      summary: "Password reset requested",
    });
  }

  return ok({ sent: true });
}

/**
 * Step 2 of the forgot-password flow: set a new password.
 *
 * Requires an authenticated session — the recovery link is consumed by
 * /auth/callback, which exchanges the code for a session before the user
 * reaches /reset-password. After the update, all other sessions for this user
 * are invalidated (covers the "someone else has my account" case).
 */
export async function completePasswordReset(
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = completePasswordResetSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail("Password does not meet requirements.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return fail("Your reset link has expired. Please request a new one.");
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateErr) {
    return fail(updateErr.message);
  }

  await supabase.auth.signOut({ scope: "others" });

  const admin = createSupabaseAdminClient();
  const [{ data: adminRow }, { data: orgRow }] = await Promise.all([
    admin.from("admin_users").select("id").eq("id", user.id).maybeSingle(),
    admin
      .from("organization_users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  await admin.from("activity_events").insert({
    organization_id: orgRow?.organization_id ?? null,
    actor_user_id: user.id,
    action: "password_reset_completed",
    target_table: adminRow ? "admin_users" : "organization_users",
    target_id: user.id,
    summary: "Password reset completed",
  });

  return ok({ redirectTo: adminRow ? "/admin" : "/portal" });
}
