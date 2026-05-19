"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createEnrollmentSchema, transitionStatusSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { validateTransition } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { inngest } from "@/inngest/client";

export async function createEnrollmentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const clientIdRaw = formData.get("clientId");

  const parsed = createEnrollmentSchema.safeParse({
    organizationId: formData.get("organizationId"),
    clientId: clientIdRaw ? String(clientIdRaw) : undefined,
    payerId: formData.get("payerId"),
    state: String(formData.get("state") ?? "").toUpperCase(),
    subStatus: formData.get("subStatus") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Resolve client_id. For group orgs the form must supply it. For individual
  // orgs we look up the singleton clinician row.
  let clientId = parsed.data.clientId;
  if (!clientId) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, kind")
      .eq("id", parsed.data.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (orgErr || !org) return fail("Organization not found");
    if (org.kind !== "individual") {
      return fail("Pick a clinician.");
    }
    const { data: singleton, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", parsed.data.organizationId)
      .is("deleted_at", null)
      .limit(2);
    if (clientErr) return fail(`Could not resolve clinician: ${clientErr.message}`);
    if (!singleton || singleton.length === 0) {
      return fail("Individual organization has no clinician row");
    }
    if (singleton.length > 1) {
      return fail("Individual organization has more than one clinician (data error)");
    }
    clientId = singleton[0]!.id;
  }

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      organization_id: parsed.data.organizationId,
      client_id: clientId,
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
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "create",
    target_table: "enrollments",
    target_id: enrollment.id,
    summary: `Created enrollment in ${parsed.data.state}`,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  revalidatePath("/admin/enrollments");
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
    .select("id, organization_id, status, sub_status")
    .eq("id", parsed.data.enrollmentId)
    .maybeSingle();

  if (fetchErr || !current) return fail("Enrollment not found");

  const transition = validateTransition(
    current.status as EnrollmentStatus,
    parsed.data.toStatus,
  );
  if (!transition.ok) return fail(transition.error);

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

  await supabase.from("activity_events").insert({
    organization_id: current.organization_id,
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

  try {
    await inngest.send({
      name: "enrollment/status_changed",
      data: {
        enrollmentId: parsed.data.enrollmentId,
        organizationId: current.organization_id,
        fromStatus: current.status,
        toStatus: parsed.data.toStatus,
      },
    });
  } catch (err) {
    console.error("[enrollment/status_changed] event emit failed", err);
  }

  revalidatePath(`/admin/organizations/${current.organization_id}/enrollments/${parsed.data.enrollmentId}`);
  return ok({ enrollmentId: parsed.data.enrollmentId, toStatus: parsed.data.toStatus });
}
