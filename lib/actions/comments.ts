"use server";
import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postCommentSchema, postInternalNoteSchema } from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function postCommentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const parsed = postCommentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    body: formData.get("body"),
    parentCommentId: formData.get("parentCommentId") || undefined,
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, organization_id")
    .eq("id", parsed.data.enrollmentId)
    .maybeSingle();
  if (!enrollment) return fail("Enrollment not found");

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      organization_id: enrollment.organization_id,
      enrollment_id: parsed.data.enrollmentId,
      parent_comment_id: parsed.data.parentCommentId ?? null,
      author_user_id: session.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !comment) {
    return fail(`Failed to post comment: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: enrollment.organization_id,
    actor_user_id: session.userId,
    action: "comment_post",
    target_table: "comments",
    target_id: comment.id,
    summary: `Comment posted on enrollment ${parsed.data.enrollmentId.slice(0, 8)}`,
  });

  revalidatePath(`/admin/organizations/${enrollment.organization_id}/enrollments/${parsed.data.enrollmentId}`);
  revalidatePath(`/portal/enrollments/${parsed.data.enrollmentId}`);

  return ok({ id: comment.id });
}

export async function postInternalNoteAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = postInternalNoteSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    body: formData.get("body"),
    parentNoteId: formData.get("parentNoteId") || undefined,
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, organization_id")
    .eq("id", parsed.data.enrollmentId)
    .maybeSingle();
  if (!enrollment) return fail("Enrollment not found");

  const { data: note, error } = await supabase
    .from("internal_notes")
    .insert({
      organization_id: enrollment.organization_id,
      enrollment_id: parsed.data.enrollmentId,
      parent_note_id: parsed.data.parentNoteId ?? null,
      author_user_id: session.userId,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !note) {
    return fail(`Failed to post internal note: ${error?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: enrollment.organization_id,
    actor_user_id: session.userId,
    action: "internal_note_post",
    target_table: "internal_notes",
    target_id: note.id,
    summary: `Internal note posted`,
  });

  revalidatePath(`/admin/organizations/${enrollment.organization_id}/enrollments/${parsed.data.enrollmentId}`);
  return ok({ id: note.id });
}
