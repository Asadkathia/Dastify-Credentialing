import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Status transition rules for enrollments.
 *
 * The DB does not enforce these — application logic does. The reasoning:
 * status changes are sometimes corrective (admin clicks the wrong status,
 * needs to back up), so we allow ANY transition to a non-terminal status,
 * but require an explicit "reason" when going backwards.
 *
 * Effective is special: it sets effective_date and triggers recred-due
 * computation in a DB trigger (see 0001_audit_triggers.sql).
 *
 * Closed and withdrawn are terminal — once there, only admin can re-open
 * (which clears them by transitioning to a non-terminal state).
 */

const FORWARD_TRANSITIONS: Record<EnrollmentStatus, ReadonlyArray<EnrollmentStatus>> = {
  intake: ["prep", "submitted", "withdrawn", "closed"],
  prep: ["submitted", "intake", "withdrawn", "closed"],
  submitted: ["in_review", "info_requested", "approved", "denied", "withdrawn", "closed"],
  in_review: ["info_requested", "approved", "denied", "submitted", "withdrawn", "closed"],
  info_requested: ["in_review", "submitted", "approved", "denied", "withdrawn", "closed"],
  approved: ["effective", "denied", "closed"],
  denied: ["info_requested", "in_review", "submitted", "withdrawn", "closed"],
  effective: ["closed"],
  closed: ["intake"],
  withdrawn: ["intake"],
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string };

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
  intake: "Intake",
  prep: "Prep",
  submitted: "Submitted",
  in_review: "In Review",
  info_requested: "Info Requested",
  approved: "Approved",
  denied: "Denied",
  effective: "Effective",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

export const STATUS_BADGE_VARIANT: Record<
  EnrollmentStatus,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
> = {
  intake: "outline",
  prep: "secondary",
  submitted: "info",
  in_review: "info",
  info_requested: "warning",
  approved: "success",
  denied: "destructive",
  effective: "success",
  closed: "secondary",
  withdrawn: "secondary",
};

export function pipelineDisplayOrder(): EnrollmentStatus[] {
  return [
    "intake",
    "prep",
    "submitted",
    "in_review",
    "info_requested",
    "approved",
    "denied",
    "effective",
  ];
}
