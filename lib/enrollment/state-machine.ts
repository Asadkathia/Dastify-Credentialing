import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Status transition rules for enrollments.
 *
 * The DB does not enforce these — application logic does. The linear happy path
 * is still prep → submitted → in_review → approved (and `non_par_credentialed`
 * is the off-rail terminal outcome), but admins may move an enrollment to ANY
 * status directly. The only rejected "transition" is a no-op (status unchanged).
 */

export type TransitionResult = { ok: true } | { ok: false; error: string };

export function validateTransition(
  from: EnrollmentStatus,
  to: EnrollmentStatus,
): TransitionResult {
  if (from === to) {
    return { ok: false, error: "Status is unchanged" };
  }

  return { ok: true };
}

export const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  prep: "Prep",
  submitted: "Submitted",
  in_review: "In Review",
  approved: "Approved",
  non_par_credentialed: "Non-par credentialed",
};

export const STATUS_BADGE_VARIANT: Record<
  EnrollmentStatus,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
> = {
  prep: "secondary",
  submitted: "info",
  in_review: "info",
  approved: "success",
  non_par_credentialed: "outline",
};

/**
 * Linear display order for the status pipeline visualization. Excludes
 * `non_par_credentialed` — that's a terminal off-rail branch and renders as an
 * overlay tag (same treatment as the old `denied` had).
 */
export function pipelineDisplayOrder(): EnrollmentStatus[] {
  return ["prep", "submitted", "in_review", "approved"];
}
