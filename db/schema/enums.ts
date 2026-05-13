import { pgEnum } from "drizzle-orm/pg-core";

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "prep",
  "submitted",
  "in_review",
  "approved",
  "non_par_credentialed",
]);

export type EnrollmentStatus = (typeof enrollmentStatusEnum.enumValues)[number];

export const ENROLLMENT_STATUSES = enrollmentStatusEnum.enumValues;

// Terminal states — no further transitions allowed.
// `approved` is the linear happy-path end; `non_par_credentialed` is the
// off-rail terminal (provider credentialed but not in-network).
export const TERMINAL_STATUSES: ReadonlySet<EnrollmentStatus> = new Set([
  "approved",
  "non_par_credentialed",
]);

export const payerTypeEnum = pgEnum("payer_type", [
  "commercial",
  "medicare",
  "medicaid",
  "tricare",
  "other",
]);

// NOTE: this enum is deprecated and retained only because the old `legacy_category`
// column on `documents` still has the type. The runtime category lookup now goes
// through the `document_categories` table (see migration 0008). New code should
// not import this enum.
export const documentCategoryEnum = pgEnum("document_category", [
  "license",
  "dea",
  "cv",
  "malpractice",
  "caqh",
  "payer_letter",
  "contract",
  "denial",
  "info_request",
  "internal_staging",
  "other",
]);

export const documentOwnerTypeEnum = pgEnum("document_owner_type", [
  "provider",
  "enrollment",
  "group_entity",
  "client",
]);

export const adminRoleEnum = pgEnum("admin_role", ["admin"]);

export const organizationUserRoleEnum = pgEnum("organization_user_role", [
  "org_admin",
  "org_viewer",
]);

export const digestFrequencyEnum = pgEnum("digest_frequency", ["off", "daily", "weekly"]);

export const activityActionEnum = pgEnum("activity_action", [
  "create",
  "update",
  "delete",
  "soft_delete",
  "restore",
  "status_change",
  "comment_post",
  "internal_note_post",
  "document_upload",
  "document_delete",
  "user_invite",
  "user_login",
  "export",
  "import",
]);
