import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { enrollments } from "./enrollments";

// Organization-visible threaded comments on an enrollment row.
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id"),
    authorUserId: uuid("author_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    organizationIdx: index("comments_organization_id_idx").on(t.organizationId),
    enrollmentIdx: index("comments_enrollment_id_idx").on(t.enrollmentId),
  }),
);

// Admin-only notes on an enrollment, parallel to comments. Never returned to org sessions.
export const internalNotes = pgTable(
  "internal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    parentNoteId: uuid("parent_note_id"),
    authorUserId: uuid("author_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    organizationIdx: index("internal_notes_organization_id_idx").on(t.organizationId),
    enrollmentIdx: index("internal_notes_enrollment_id_idx").on(t.enrollmentId),
  }),
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type NewInternalNote = typeof internalNotes.$inferInsert;
