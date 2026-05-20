"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/reauth";
import {
  createEnrollmentSchema,
  transitionStatusSchema,
  deleteEnrollmentSchema,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { validateTransition } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { after } from "next/server";
import { drainNotificationQueue } from "@/lib/notifications/process";

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

const DOCUMENTS_BUCKET = "documents";

/**
 * Delete an enrollment (admin-only).
 *
 *  - `soft`: sets `deleted_at`. Reversible, preserves all history, and frees the
 *    (organization, client, payer, state) slot for re-enrollment via the partial
 *    unique index. This is the default.
 *  - `hard`: permanent purge. Requires admin re-authentication (password). Deletes
 *    the row — which cascades comments + internal_notes and null-sets
 *    status_history (append-only audit survives, rule 6) — then cleans up the
 *    no-FK orphans: enrollment-owned documents (rows + Storage files) and any
 *    queued notifications. Runs through the service-role client because
 *    notification_queue is service-role-only (RLS, no policies).
 */
export async function deleteEnrollmentAction(
  formData: FormData,
): Promise<ActionResult<{ enrollmentId: string; organizationId: string; mode: "soft" | "hard" }>> {
  const session = await requireAdmin();

  const parsed = deleteEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    mode: formData.get("mode") || "soft",
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data: enrollment, error: fetchErr } = await supabase
    .from("enrollments")
    .select("id, organization_id, state, deleted_at")
    .eq("id", parsed.data.enrollmentId)
    .maybeSingle();
  if (fetchErr || !enrollment) return fail("Enrollment not found");

  if (parsed.data.mode === "soft") {
    if (enrollment.deleted_at) return fail("Enrollment is already deleted.");

    const { error: updErr } = await supabase
      .from("enrollments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", enrollment.id)
      .is("deleted_at", null);
    if (updErr) return fail(`Failed to delete enrollment: ${updErr.message}`);

    await supabase.from("activity_events").insert({
      organization_id: enrollment.organization_id,
      actor_user_id: session.userId,
      action: "soft_delete",
      target_table: "enrollments",
      target_id: enrollment.id,
      summary: `Deleted enrollment in ${enrollment.state}`,
    });
  } else {
    // Hard delete — step-up reauth before an irreversible purge.
    const valid = await verifyPassword(session.email, parsed.data.password!);
    if (!valid) return fail("Admin password is incorrect.");

    const admin = createSupabaseAdminClient();

    // Collect enrollment-owned document storage paths before the rows go (these
    // have no FK to the enrollment, so they would otherwise be orphaned).
    const { data: docs } = await admin
      .from("documents")
      .select("id, storage_path")
      .eq("owner_type", "enrollment")
      .eq("owner_id", enrollment.id);

    const { error: delErr } = await admin.from("enrollments").delete().eq("id", enrollment.id);
    if (delErr) return fail(`Failed to permanently delete enrollment: ${delErr.message}`);

    if (docs && docs.length > 0) {
      const paths = docs.map((d) => d.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await admin.storage.from(DOCUMENTS_BUCKET).remove(paths);
      }
      await admin
        .from("documents")
        .delete()
        .eq("owner_type", "enrollment")
        .eq("owner_id", enrollment.id);
    }
    await admin.from("notification_queue").delete().eq("enrollment_id", enrollment.id);

    await admin.from("activity_events").insert({
      organization_id: enrollment.organization_id,
      actor_user_id: session.userId,
      action: "delete",
      target_table: "enrollments",
      target_id: enrollment.id,
      summary: `Permanently deleted enrollment in ${enrollment.state}`,
    });
  }

  revalidatePath("/admin/enrollments");
  revalidatePath(`/admin/organizations/${enrollment.organization_id}`);
  revalidatePath(`/admin/organizations/${enrollment.organization_id}/enrollments`);
  return ok({
    enrollmentId: enrollment.id,
    organizationId: enrollment.organization_id,
    mode: parsed.data.mode,
  });
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

  // The status change was enqueued atomically by the DB trigger
  // (trg_enqueue_status_change). Drain the queue after the response so the
  // email goes out immediately; the cron is the durability backstop.
  after(async () => {
    try {
      await drainNotificationQueue(10);
    } catch (err) {
      console.error("[notifications] immediate drain failed", err);
    }
  });

  revalidatePath(`/admin/organizations/${current.organization_id}/enrollments/${parsed.data.enrollmentId}`);
  return ok({ enrollmentId: parsed.data.enrollmentId, toStatus: parsed.data.toStatus });
}
