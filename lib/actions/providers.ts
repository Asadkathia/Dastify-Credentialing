"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProviderSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function createProviderAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = createProviderSchema.safeParse({
    clientId: formData.get("clientId"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || "",
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || "",
    npi: formData.get("npi") || "",
    primarySpecialty: formData.get("primarySpecialty") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    caqhId: formData.get("caqhId") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: provider, error } = await supabase
    .from("providers")
    .insert({
      client_id: parsed.data.clientId,
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName || null,
      last_name: parsed.data.lastName,
      suffix: parsed.data.suffix || null,
      npi: parsed.data.npi || null,
      primary_specialty: parsed.data.primarySpecialty || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      caqh_id: parsed.data.caqhId || null,
    })
    .select("id")
    .single();

  if (error || !provider) {
    return fail(`Failed to create provider: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    client_id: parsed.data.clientId,
    actor_user_id: session.userId,
    action: "create",
    target_table: "providers",
    target_id: provider.id,
    summary: `Created provider ${parsed.data.firstName} ${parsed.data.lastName}`,
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return ok({ id: provider.id });
}
