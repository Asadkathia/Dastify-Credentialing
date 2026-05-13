import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { clients, groupEntities } from "./clients";
import { payers } from "./payers";
import { enrollmentStatusEnum } from "./enums";

// The core "claim": one client (clinician) OR group, one payer, one US state.
// Migration 0009 removed cycle_number / parent_enrollment_id / next_recred_due_date
// / denied_reason as part of the recredentialing-module removal.
// Migration 0013 renamed: client_id → organization_id, provider_id → client_id.
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    groupEntityId: uuid("group_entity_id").references(() => groupEntities.id, {
      onDelete: "cascade",
    }),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => payers.id, { onDelete: "restrict" }),
    state: text("state").notNull(), // 2-char US state code, validated by CHECK constraint
    status: enrollmentStatusEnum("status").notNull().default("prep"),
    subStatus: text("sub_status"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    effectiveDate: date("effective_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    organizationIdx: index("enrollments_organization_id_idx").on(t.organizationId),
    clientIdx: index("enrollments_client_id_idx").on(t.clientId),
    groupIdx: index("enrollments_group_entity_id_idx").on(t.groupEntityId),
    payerIdx: index("enrollments_payer_id_idx").on(t.payerId),
    statusIdx: index("enrollments_status_idx").on(t.organizationId, t.status),
    // Exactly one of client_id / group_entity_id must be set.
    subjectXorCheck: check(
      "enrollments_subject_xor",
      sql`(client_id IS NULL) <> (group_entity_id IS NULL)`,
    ),
    stateCheck: check("enrollments_state_format", sql`${t.state} ~ '^[A-Z]{2}$'`),
    // Uniqueness for individual-client enrollments — natural key per organization.
    uniqueIndividual: uniqueIndex("enrollments_unique_individual_idx")
      .on(t.organizationId, t.clientId, t.payerId, t.state)
      .where(sql`${t.clientId} IS NOT NULL`),
    // Uniqueness for group enrollments.
    uniqueGroup: uniqueIndex("enrollments_unique_group_idx")
      .on(t.organizationId, t.groupEntityId, t.payerId, t.state)
      .where(sql`${t.groupEntityId} IS NOT NULL`),
  }),
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
