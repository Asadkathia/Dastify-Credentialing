import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { enrollments } from "./enrollments";
import { enrollmentStatusEnum, activityActionEnum } from "./enums";

// Append-only log of every status transition on every enrollment.
// FKs use SET NULL on parent delete so audit history outlives its subjects
// (see migrations/0005_audit_fk_set_null.sql).
export const statusHistory = pgTable(
  "status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    fromStatus: enrollmentStatusEnum("from_status"),
    toStatus: enrollmentStatusEnum("to_status").notNull(),
    fromSubStatus: text("from_sub_status"),
    toSubStatus: text("to_sub_status"),
    reason: text("reason"),
    changedByUserId: uuid("changed_by_user_id").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enrollmentIdx: index("status_history_enrollment_id_idx").on(t.enrollmentId, t.changedAt),
    organizationIdx: index("status_history_organization_id_idx").on(t.organizationId, t.changedAt),
  }),
);

// Append-only catch-all activity log: comments posted, docs uploaded, fields edited, logins, exports.
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id"),
    action: activityActionEnum("action").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: uuid("target_id"),
    summary: text("summary"),
    diff: jsonb("diff").$type<Record<string, { from: unknown; to: unknown }>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    organizationIdx: index("activity_events_organization_id_idx").on(t.organizationId, t.occurredAt),
    targetIdx: index("activity_events_target_idx").on(t.targetTable, t.targetId),
    actorIdx: index("activity_events_actor_idx").on(t.actorUserId, t.occurredAt),
  }),
);

export type StatusHistory = typeof statusHistory.$inferSelect;
export type NewStatusHistory = typeof statusHistory.$inferInsert;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;
