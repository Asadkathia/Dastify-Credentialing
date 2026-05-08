import { pgEnum } from "drizzle-orm/pg-core";

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "intake",
  "prep",
  "submitted",
  "in_review",
  "info_requested",
  "approved",
  "denied",
  "effective",
  "closed",
  "withdrawn",
]);

export type EnrollmentStatus = (typeof enrollmentStatusEnum.enumValues)[number];

export const ENROLLMENT_STATUSES = enrollmentStatusEnum.enumValues;

export const TERMINAL_STATUSES: ReadonlySet<EnrollmentStatus> = new Set([
  "closed",
  "withdrawn",
  "effective",
]);

export const payerTypeEnum = pgEnum("payer_type", [
  "commercial",
  "medicare",
  "medicaid",
  "tricare",
  "other",
]);

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

export const clientUserRoleEnum = pgEnum("client_user_role", [
  "client_admin",
  "client_viewer",
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
]);
