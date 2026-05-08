import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { enrollments } from "./enrollments";

// Client-visible threaded comments on an enrollment row.
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
    clientIdx: index("comments_client_id_idx").on(t.clientId),
    enrollmentIdx: index("comments_enrollment_id_idx").on(t.enrollmentId),
  }),
);

// Admin-only notes on an enrollment, parallel to comments. Never returned to client sessions.
export const internalNotes = pgTable(
  "internal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
    clientIdx: index("internal_notes_client_id_idx").on(t.clientId),
    enrollmentIdx: index("internal_notes_enrollment_id_idx").on(t.enrollmentId),
  }),
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type NewInternalNote = typeof internalNotes.$inferInsert;
