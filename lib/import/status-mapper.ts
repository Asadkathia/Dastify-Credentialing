import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";

// Maps legacy status text (as found in real Excel files) to the current
// 5-status enum. Keep aliases conservative — anything we can't confidently
// match returns null so the importer surfaces it as a row error rather than
// silently mis-bucketing a real-world status.

const STATUS_ALIASES: Record<string, EnrollmentStatus> = {
  // prep
  prep: "prep",
  "in prep": "prep",
  preparation: "prep",
  "gathering documents": "prep",
  "not started": "prep",
  "in progress": "prep",

  // submitted
  submitted: "submitted",
  "submission complete": "submitted",
  "submission sent": "submitted",
  filed: "submitted",
  "with payer": "submitted",

  // in_review
  "in review": "in_review",
  in_review: "in_review",
  review: "in_review",
  "under review": "in_review",
  "credentialing committee": "in_review",
  pending: "in_review",
  "info requested": "in_review",
  "additional info requested": "in_review",

  // approved (linear happy-path terminal — covers `effective`/`active` from
  // the legacy pre-pipeline schema)
  approved: "approved",
  effective: "approved",
  active: "approved",
  participating: "approved",
  par: "approved",
  "in network": "approved",
  "in-network": "approved",
  inn: "approved",

  // non_par_credentialed (off-rail terminal)
  "non par": "non_par_credentialed",
  "non-par": "non_par_credentialed",
  nonpar: "non_par_credentialed",
  "non par credentialed": "non_par_credentialed",
  "non-par credentialed": "non_par_credentialed",
  "nonpar credentialed": "non_par_credentialed",
  "credentialed non-par": "non_par_credentialed",
  "credentialed only": "non_par_credentialed",
  oon: "non_par_credentialed",
  "out of network": "non_par_credentialed",
  "out-of-network": "non_par_credentialed",
};

/**
 * Normalize a free-form status string (case-insensitive, whitespace-flexible)
 * to one of the 5 enum values, or null when nothing matches.
 *
 * Exact enum values always match (so a clean export-then-import round-trips).
 */
export function normalizeStatusText(input: string | null | undefined): EnrollmentStatus | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Exact enum value (case-insensitive)?
  const lower = trimmed.toLowerCase().replace(/\s+/g, "_");
  const enumHit = (ENROLLMENT_STATUSES as readonly string[]).find((s) => s === lower);
  if (enumHit) return enumHit as EnrollmentStatus;

  // Alias map (case-insensitive, whitespace-collapsed).
  const key = trimmed.toLowerCase().replace(/\s+/g, " ").trim();
  return STATUS_ALIASES[key] ?? null;
}
