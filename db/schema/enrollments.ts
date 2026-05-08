import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clients } from "./clients";
import { providers, groupEntities } from "./providers";
import { payers } from "./payers";
import { enrollmentStatusEnum } from "./enums";

// The core "claim": one provider OR group, one payer, one US state, one cycle.
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }),
    groupEntityId: uuid("group_entity_id").references(() => groupEntities.id, {
      onDelete: "cascade",
    }),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => payers.id, { onDelete: "restrict" }),
    state: text("state").notNull(), // 2-char US state code, validated by CHECK constraint
    cycleNumber: integer("cycle_number").notNull().default(1),
    parentEnrollmentId: uuid("parent_enrollment_id"),
    status: enrollmentStatusEnum("status").notNull().default("intake"),
    subStatus: text("sub_status"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    effectiveDate: date("effective_date"),
    nextRecredDueDate: date("next_recred_due_date"),
    deniedReason: text("denied_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index("enrollments_client_id_idx").on(t.clientId),
    providerIdx: index("enrollments_provider_id_idx").on(t.providerId),
    groupIdx: index("enrollments_group_entity_id_idx").on(t.groupEntityId),
    payerIdx: index("enrollments_payer_id_idx").on(t.payerId),
    statusIdx: index("enrollments_status_idx").on(t.clientId, t.status),
    recredDueIdx: index("enrollments_recred_due_idx").on(t.nextRecredDueDate),
    // Exactly one of provider_id / group_entity_id must be set.
    subjectXorCheck: check(
      "enrollments_subject_xor",
      sql`(provider_id IS NULL) <> (group_entity_id IS NULL)`,
    ),
    stateCheck: check("enrollments_state_format", sql`${t.state} ~ '^[A-Z]{2}$'`),
    cycleCheck: check("enrollments_cycle_positive", sql`${t.cycleNumber} >= 1`),
    // Uniqueness for individual enrollments.
    uniqueIndividual: uniqueIndex("enrollments_unique_individual_idx")
      .on(t.clientId, t.providerId, t.payerId, t.state, t.cycleNumber)
      .where(sql`${t.providerId} IS NOT NULL`),
    // Uniqueness for group enrollments.
    uniqueGroup: uniqueIndex("enrollments_unique_group_idx")
      .on(t.clientId, t.groupEntityId, t.payerId, t.state, t.cycleNumber)
      .where(sql`${t.groupEntityId} IS NOT NULL`),
  }),
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
