"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClientSchema, updateClientSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

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
