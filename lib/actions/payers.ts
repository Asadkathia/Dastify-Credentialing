"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPayerSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

/**
 * Admin-only: append a new payer to the global master list.
 *
 * The `payers` table is global (not tenant-scoped) — payers are shared across
 * all clients. RLS policy `payers_admin_insert` enforces admin-only writes.
 *
 * If a payer with the same case-insensitive name already exists, return that
 * existing row's id instead of erroring (idempotent — useful when the user
 * types something like "Aetna" when "Aetna" is already in the list).
 */
export async function createPayerAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; isExisting: boolean }>> {
  await requireAdmin();

  const parsed = createPayerSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid payer input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Check for existing case-insensitive name match.
  const { data: existing } = await supabase
    .from("payers")
    .select("id, name")
    .ilike("name", parsed.data.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return ok({ id: existing.id, name: existing.name, isExisting: true });
  }

  const { data: created, error } = await supabase
    .from("payers")
    .insert({
      name: parsed.data.name,
      payer_type: parsed.data.payerType,
      states_active: parsed.data.statesActive,
      recred_cycle_months: parsed.data.recredCycleMonths,
    })
    .select("id, name")
    .single();

  if (error || !created) {
    return fail(`Failed to add payer: ${error?.message ?? "unknown"}`);
  }

  revalidatePath("/admin/payers");
  return ok({ id: created.id, name: created.name, isExisting: false });
}
