import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Status transition rules for enrollments.
 *
 * The DB does not enforce these — application logic does. Linear happy path:
 *
 *   prep → submitted → in_review → approved → completed
 *
 * `non_par_credentialed` is a terminal off-rail outcome — provider is
 * credentialed by the payer but not added to the participating network.
 * Reachable from any review-or-later state, and (like `completed`) terminal.
 *
 * Backwards/corrective moves are allowed from any non-terminal state into the
 * preceding active states, so admins can fix mis-clicks without writing SQL.
 */

const FORWARD_TRANSITIONS: Record<EnrollmentStatus, ReadonlyArray<EnrollmentStatus>> = {
  prep: ["submitted"],
  submitted: ["in_review", "prep"],
  in_review: ["approved", "non_par_credentialed", "submitted"],
  approved: ["completed", "non_par_credentialed", "in_review"],
  // Terminal states — admin can re-open by moving back to a prior active state.
  non_par_credentialed: ["in_review", "approved"],
  completed: ["approved"],
};

export type TransitionResult = { ok: true } | { ok: false; error: string };

export function validateTransition(
  from: EnrollmentStatus,
  to: EnrollmentStatus,
): TransitionResult {
  if (from === to) {
    return { ok: false, error: "Status is unchanged" };
  }

  const allowed = FORWARD_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}.`,
    };
  }

  return { ok: true };
}

export const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  prep: "Prep",
  submitted: "Submitted",
  in_review: "In Review",
  approved: "Approved",
  non_par_credentialed: "Non-par credentialed",
  completed: "Completed",
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
  completed: "success",
};

/**
 * Linear display order for the status pipeline visualization. Excludes
 * `non_par_credentialed` — that's a terminal off-rail branch and renders as an
 * overlay tag (same treatment as the old `denied` had).
 */
export function pipelineDisplayOrder(): EnrollmentStatus[] {
  return ["prep", "submitted", "in_review", "approved", "completed"];
}
