"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEnrollmentSchema, transitionStatusSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { validateTransition } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

export async function createEnrollmentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const providerId = formData.get("providerId");
  const groupEntityId = formData.get("groupEntityId");

  const parsed = createEnrollmentSchema.safeParse({
    clientId: formData.get("clientId"),
    providerId: providerId ? String(providerId) : undefined,
    groupEntityId: groupEntityId ? String(groupEntityId) : undefined,
    payerId: formData.get("payerId"),
    state: String(formData.get("state") ?? "").toUpperCase(),
    subStatus: formData.get("subStatus") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      client_id: parsed.data.clientId,
      provider_id: parsed.data.providerId ?? null,
      group_entity_id: parsed.data.groupEntityId ?? null,
      payer_id: parsed.data.payerId,
      state: parsed.data.state,
      status: "prep",
      sub_status: parsed.data.subStatus || null,
    })
    .select("id")
    .single();

  if (error || !enrollment) {
    return fail(`Failed to create enrollment: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    client_id: parsed.data.clientId,
    actor_user_id: session.userId,
    action: "create",
    target_table: "enrollments",
    target_id: enrollment.id,
    summary: `Created enrollment in ${parsed.data.state}`,
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return ok({ id: enrollment.id });
}

export async function transitionStatusAction(
  formData: FormData,
): Promise<ActionResult<{ enrollmentId: string; toStatus: EnrollmentStatus }>> {
  const session = await requireAdmin();

  const parsed = transitionStatusSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    toStatus: formData.get("toStatus"),
    subStatus: formData.get("subStatus") || "",
    reason: formData.get("reason") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: current, error: fetchErr } = await supabase
    .from("enrollments")
    .select("id, client_id, status, sub_status")
    .eq("id", parsed.data.enrollmentId)
    .maybeSingle();

  if (fetchErr || !current) return fail("Enrollment not found");

  const transition = validateTransition(
    current.status as EnrollmentStatus,
    parsed.data.toStatus,
  );
  if (!transition.ok) return fail(transition.error);

  // Side-effect: set submitted_at the first time the row enters `submitted`.
  // effective_date is no longer auto-set (recred module is gone) — admins can
  // edit it via the standard update path if/when we expose that field again.
  const { error: updateErr } = await supabase
    .from("enrollments")
    .update({
      status: parsed.data.toStatus,
      sub_status: parsed.data.subStatus || null,
      submitted_at:
        parsed.data.toStatus === "submitted" && current.status !== "submitted"
          ? new Date().toISOString()
          : undefined,
    })
    .eq("id", parsed.data.enrollmentId);

  if (updateErr) {
    return fail(`Failed to transition status: ${updateErr.message}`);
  }

  // The status_history row is inserted by the audit trigger automatically.
  // We separately log the activity_event for the high-level feed.
  await supabase.from("activity_events").insert({
    client_id: current.client_id,
    actor_user_id: session.userId,
    action: "status_change",
    target_table: "enrollments",
    target_id: parsed.data.enrollmentId,
    summary: `${current.status} → ${parsed.data.toStatus}${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}`,
    diff: {
      status: { from: current.status, to: parsed.data.toStatus },
      sub_status: { from: current.sub_status, to: parsed.data.subStatus || null },
    },
  });

  revalidatePath(`/admin/clients/${current.client_id}/enrollments/${parsed.data.enrollmentId}`);
  return ok({ enrollmentId: parsed.data.enrollmentId, toStatus: parsed.data.toStatus });
}
