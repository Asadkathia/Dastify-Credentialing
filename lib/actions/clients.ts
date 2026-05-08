"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClientSchema, inviteClientUserSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function createClientAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = createClientSchema.safeParse({
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

  const { data: client, error } = await supabase
    .from("clients")
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

  if (error || !client) {
    return fail(`Failed to create client: ${error?.message ?? "unknown"}`);
  }

  // Auto-create default settings row.
  await supabase.from("client_settings").insert({ client_id: client.id });

  await supabase.from("activity_events").insert({
    client_id: client.id,
    actor_user_id: session.userId,
    action: "create",
    target_table: "clients",
    target_id: client.id,
    summary: `Created client ${parsed.data.displayName}`,
  });

  revalidatePath("/admin");
  return ok({ id: client.id });
}

export async function createClientAndRedirect(formData: FormData): Promise<void> {
  const result = await createClientAction(formData);
  if (!result.ok) {
    // Server actions can't return rich errors via redirect; encode minimally.
    redirect(`/admin/clients/new?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/clients/${result.data.id}`);
}

export async function inviteClientUserAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  const session = await requireAdmin();

  const parsed = inviteClientUserSchema.safeParse({
    clientId: formData.get("clientId"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role") || "client_viewer",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Confirm the client exists (RLS will let admins see all clients).
  const { data: client } = await supabase
    .from("clients")
    .select("id, display_name")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!client) return fail("Client not found");

  // Use the service-role client to create the auth user + send invite email.
  const adminSupabase = createSupabaseAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

  const { data: invited, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      redirectTo,
      data: { full_name: parsed.data.fullName, client_id: parsed.data.clientId },
    },
  );
  if (inviteErr || !invited.user) {
    return fail(`Invite failed: ${inviteErr?.message ?? "unknown"}`);
  }

  // Insert the corresponding client_users row (using admin client to bypass RLS
  // on first insert, since the invited user hasn't logged in yet).
  const { error: insertErr } = await adminSupabase.from("client_users").insert({
    id: invited.user.id,
    client_id: parsed.data.clientId,
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    invited_by_user_id: session.userId,
  });
  if (insertErr) {
    return fail(`Invite created but profile insert failed: ${insertErr.message}`);
  }

  await supabase.from("activity_events").insert({
    client_id: parsed.data.clientId,
    actor_user_id: session.userId,
    action: "user_invite",
    target_table: "client_users",
    target_id: invited.user.id,
    summary: `Invited ${parsed.data.email} (${parsed.data.role}) to ${client.display_name}`,
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return ok({ userId: invited.user.id });
}
