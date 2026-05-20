"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/reauth";
import {
  createClientSchema,
  deleteEntitySchema,
  updateClientSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

const DOCUMENTS_BUCKET = "documents";

export async function createClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = createClientSchema.safeParse({
    organizationId: formData.get("organizationId"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || "",
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || "",
    npi: formData.get("npi") || "",
    primarySpecialty: formData.get("primarySpecialty") || "",
    secondarySpecialty: formData.get("secondarySpecialty") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    caqhId: formData.get("caqhId") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      organization_id: parsed.data.organizationId,
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName || null,
      last_name: parsed.data.lastName,
      suffix: parsed.data.suffix || null,
      npi: parsed.data.npi || null,
      primary_specialty: parsed.data.primarySpecialty || null,
      secondary_specialty: parsed.data.secondarySpecialty || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      caqh_id: parsed.data.caqhId || null,
    })
    .select("id")
    .single();

  if (error || !client) {
    return fail(`Failed to create client: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "create",
    target_table: "clients",
    target_id: client.id,
    summary: `Created client ${parsed.data.firstName} ${parsed.data.lastName}`,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  return ok({ id: client.id });
}

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = updateClientSchema.safeParse({
    clientId: formData.get("clientId"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || "",
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || "",
    npi: formData.get("npi") || "",
    primarySpecialty: formData.get("primarySpecialty") || "",
    secondarySpecialty: formData.get("secondarySpecialty") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    caqhId: formData.get("caqhId") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("clients")
    .select("id, organization_id")
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (fetchErr || !existing) return fail("Client not found");

  const { error: updateErr } = await supabase
    .from("clients")
    .update({
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName || null,
      last_name: parsed.data.lastName,
      suffix: parsed.data.suffix || null,
      npi: parsed.data.npi || null,
      primary_specialty: parsed.data.primarySpecialty || null,
      secondary_specialty: parsed.data.secondarySpecialty || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      caqh_id: parsed.data.caqhId || null,
    })
    .eq("id", parsed.data.clientId);
  if (updateErr) {
    return fail(`Failed to update client: ${updateErr.message}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: existing.organization_id,
    actor_user_id: session.userId,
    action: "update",
    target_table: "clients",
    target_id: parsed.data.clientId,
    summary: `Updated client ${parsed.data.firstName} ${parsed.data.lastName}`,
  });

  revalidatePath(`/admin/organizations/${existing.organization_id}/clients/${parsed.data.clientId}`);
  revalidatePath(`/admin/organizations/${existing.organization_id}`);
  return ok({ id: parsed.data.clientId });
}

/**
 * Delete a clinician (admin-only).
 *
 * Blocked for individual organizations — there the clinician IS the org's sole
 * member (rule 28), so the org should be deleted instead.
 *
 *  - `soft`: sets the client's deleted_at and soft-deletes its still-active
 *    enrollments so they drop out of lists. Reversible.
 *  - `hard`: permanent purge. Requires admin re-authentication. Deletes the
 *    client row — which cascades its enrollments (→ comments / internal_notes,
 *    null-sets status_history) — then cleans up the no-FK orphans: client- and
 *    enrollment-owned documents (rows + Storage files) and queued
 *    notifications. Runs via the service-role client.
 */
export async function deleteClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; organizationId: string; mode: "soft" | "hard" }>> {
  const session = await requireAdmin();

  const parsed = deleteEntitySchema.safeParse({
    id: formData.get("id"),
    mode: formData.get("mode") || "soft",
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: client, error: fetchErr } = await supabase
    .from("clients")
    .select("id, organization_id, first_name, last_name, deleted_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (fetchErr || !client) return fail("Clinician not found");

  const { data: org } = await supabase
    .from("organizations")
    .select("kind")
    .eq("id", client.organization_id)
    .maybeSingle();
  if (org?.kind === "individual") {
    return fail(
      "This clinician is the sole member of an individual organization. Delete the organization instead.",
    );
  }

  const fullName = `${client.first_name} ${client.last_name}`;

  if (parsed.data.mode === "soft") {
    if (client.deleted_at) return fail("Clinician is already deleted.");

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("clients")
      .update({ deleted_at: now })
      .eq("id", client.id)
      .is("deleted_at", null);
    if (updErr) return fail(`Failed to delete clinician: ${updErr.message}`);

    // Archive the clinician's still-active enrollments alongside them.
    await supabase
      .from("enrollments")
      .update({ deleted_at: now })
      .eq("client_id", client.id)
      .is("deleted_at", null);

    await supabase.from("activity_events").insert({
      organization_id: client.organization_id,
      actor_user_id: session.userId,
      action: "soft_delete",
      target_table: "clients",
      target_id: client.id,
      summary: `Deleted clinician ${fullName}`,
    });
  } else {
    const valid = await verifyPassword(session.email, parsed.data.password!);
    if (!valid) return fail("Admin password is incorrect.");

    const admin = createSupabaseAdminClient();

    const { data: enrs } = await admin
      .from("enrollments")
      .select("id")
      .eq("client_id", client.id);
    const enrIds = (enrs ?? []).map((e) => e.id);

    // Collect document Storage paths (client-owned + the enrollments' docs)
    // before the rows go — these are polymorphic with no FK cascade.
    const { data: clientDocs } = await admin
      .from("documents")
      .select("storage_path")
      .eq("owner_type", "client")
      .eq("owner_id", client.id);
    let enrollmentDocs: { storage_path: string }[] = [];
    if (enrIds.length > 0) {
      const { data } = await admin
        .from("documents")
        .select("storage_path")
        .eq("owner_type", "enrollment")
        .in("owner_id", enrIds);
      enrollmentDocs = data ?? [];
    }

    if (enrIds.length > 0) {
      await admin.from("notification_queue").delete().in("enrollment_id", enrIds);
    }

    const { error: delErr } = await admin.from("clients").delete().eq("id", client.id);
    if (delErr) return fail(`Failed to permanently delete clinician: ${delErr.message}`);

    await admin.from("documents").delete().eq("owner_type", "client").eq("owner_id", client.id);
    if (enrIds.length > 0) {
      await admin.from("documents").delete().eq("owner_type", "enrollment").in("owner_id", enrIds);
    }
    const paths = [...clientDocs ?? [], ...enrollmentDocs]
      .map((d) => d.storage_path)
      .filter(Boolean);
    if (paths.length > 0) {
      await admin.storage.from(DOCUMENTS_BUCKET).remove(paths);
    }

    await admin.from("activity_events").insert({
      organization_id: client.organization_id,
      actor_user_id: session.userId,
      action: "delete",
      target_table: "clients",
      target_id: client.id,
      summary: `Permanently deleted clinician ${fullName}`,
    });
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/organizations/${client.organization_id}`);
  revalidatePath(`/admin/organizations/${client.organization_id}/clients/${client.id}`);
  return ok({ id: client.id, organizationId: client.organization_id, mode: parsed.data.mode });
}
