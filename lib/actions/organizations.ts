"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createOrganizationSchema,
  inviteOrganizationUserSchema,
  revokeOrganizationUserSchema,
  updateOrganizationSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function createOrganizationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = createOrganizationSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    primaryContactName: formData.get("primaryContactName") || "",
    primaryContactEmail: formData.get("primaryContactEmail") || "",
    primaryContactPhone: formData.get("primaryContactPhone") || "",
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({
      legal_name: parsed.data.legalName,
      display_name: parsed.data.displayName,
      primary_contact_name: parsed.data.primaryContactName || null,
      primary_contact_email: parsed.data.primaryContactEmail || null,
      primary_contact_phone: parsed.data.primaryContactPhone || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error || !org) {
    return fail(`Failed to create organization: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("organization_settings").insert({ organization_id: org.id });

  await supabase.from("activity_events").insert({
    organization_id: org.id,
    actor_user_id: session.userId,
    action: "create",
    target_table: "organizations",
    target_id: org.id,
    summary: `Created organization ${parsed.data.displayName}`,
  });

  revalidatePath("/admin");
  return ok({ id: org.id });
}

export async function updateOrganizationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = updateOrganizationSchema.safeParse({
    organizationId: formData.get("organizationId"),
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    primaryContactName: formData.get("primaryContactName") || "",
    primaryContactEmail: formData.get("primaryContactEmail") || "",
    primaryContactPhone: formData.get("primaryContactPhone") || "",
    notes: formData.get("notes") || "",
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchErr || !existing) return fail("Organization not found");

  const { error: updateErr } = await supabase
    .from("organizations")
    .update({
      legal_name: parsed.data.legalName,
      display_name: parsed.data.displayName,
      primary_contact_name: parsed.data.primaryContactName || null,
      primary_contact_email: parsed.data.primaryContactEmail || null,
      primary_contact_phone: parsed.data.primaryContactPhone || null,
      notes: parsed.data.notes || null,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.organizationId);
  if (updateErr) {
    return fail(`Failed to update organization: ${updateErr.message}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "update",
    target_table: "organizations",
    target_id: parsed.data.organizationId,
    summary: `Updated organization ${parsed.data.displayName}`,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  return ok({ id: parsed.data.organizationId });
}

export async function createOrganizationAndRedirect(formData: FormData): Promise<void> {
  const result = await createOrganizationAction(formData);
  if (!result.ok) {
    redirect(`/admin/organizations/new?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/organizations/${result.data.id}`);
}

export async function inviteOrganizationUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string; authMethod: "magic_link" | "password" }>> {
  const session = await requireAdmin();

  const passwordRaw = formData.get("password");
  const parsed = inviteOrganizationUserSchema.safeParse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role") || "org_viewer",
    authMethod: formData.get("authMethod") || "magic_link",
    password: passwordRaw ? String(passwordRaw) : undefined,
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, display_name")
    .eq("id", parsed.data.organizationId)
    .maybeSingle();
  if (!org) return fail("Organization not found");

  const adminSupabase = createSupabaseAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

  let userId: string;

  if (parsed.data.authMethod === "password") {
    const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName, organization_id: parsed.data.organizationId },
    });
    if (createErr || !created.user) {
      return fail(`Account creation failed: ${createErr?.message ?? "unknown"}`);
    }
    userId = created.user.id;
  } else {
    const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo,
        data: { full_name: parsed.data.fullName, organization_id: parsed.data.organizationId },
      },
    );
    if (inviteErr || !invited.user) {
      return fail(`Invite failed: ${inviteErr?.message ?? "unknown"}`);
    }
    userId = invited.user.id;
  }

  const { error: insertErr } = await adminSupabase.from("organization_users").insert({
    id: userId,
    organization_id: parsed.data.organizationId,
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    invited_by_user_id: session.userId,
    accepted_at: parsed.data.authMethod === "password" ? new Date().toISOString() : null,
  });
  if (insertErr) {
    return fail(`Account created but profile insert failed: ${insertErr.message}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "user_invite",
    target_table: "organization_users",
    target_id: userId,
    summary: `${
      parsed.data.authMethod === "password" ? "Created account for" : "Invited"
    } ${parsed.data.email} (${parsed.data.role}) to ${org.display_name}`,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  return ok({ userId, authMethod: parsed.data.authMethod });
}

// Revokes a portal user's access to an organization. Handles both pending
// invites (accepted_at is null) and accepted members in one path:
//   1. Soft-revoke: organization_users.is_active = false (preserves audit
//      history; the session helper denies access when is_active is false).
//   2. Auth ban: supabase.auth.admin.updateUserById with ban_duration so the
//      auth provider rejects future logins and outstanding magic links.
//   3. Activity event with action='user_revoke' for the audit trail.
export async function revokeOrganizationUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string; wasPending: boolean }>> {
  const session = await requireAdmin();

  const parsed = revokeOrganizationUserSchema.safeParse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.userId === session.userId) {
    return fail("You cannot revoke your own access");
  }

  const supabase = await createSupabaseServerClient();

  const { data: target, error: fetchErr } = await supabase
    .from("organization_users")
    .select("id, email, organization_id, accepted_at, is_active")
    .eq("id", parsed.data.userId)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();
  if (fetchErr || !target) {
    return fail("User not found in this organization");
  }
  if (!target.is_active) {
    return fail("User is already revoked");
  }

  const wasPending = target.accepted_at === null;

  const { error: updateErr } = await supabase
    .from("organization_users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);
  if (updateErr) {
    return fail(`Failed to revoke access: ${updateErr.message}`);
  }

  // 876000h ≈ 100 years — Supabase's documented forever-ban idiom.
  const adminSupabase = createSupabaseAdminClient();
  const { error: banErr } = await adminSupabase.auth.admin.updateUserById(
    parsed.data.userId,
    { ban_duration: "876000h" },
  );
  if (banErr) {
    return fail(
      `Access revoked in app, but auth ban failed: ${banErr.message}. Please retry or contact support.`,
    );
  }

  await supabase.from("activity_events").insert({
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "user_revoke",
    target_table: "organization_users",
    target_id: parsed.data.userId,
    summary: `Revoked access for ${target.email} (${wasPending ? "pending invite" : "active user"})`,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  return ok({ userId: parsed.data.userId, wasPending });
}
