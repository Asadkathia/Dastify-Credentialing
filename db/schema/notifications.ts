import { pgTable, uuid, text, jsonb, integer, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// Durable outbox for app transactional emails (status changes, comments).
// Enqueued by DB triggers (see migration 0019), drained by the cron worker +
// after() immediate attempt. Service-role-only: RLS enabled, no policies.
export const notificationQueue = pgTable(
  "notification_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // 'status_change' | 'comment'
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    enrollmentId: uuid("enrollment_id"),
    commentId: uuid("comment_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed'
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dueIdx: index("notification_queue_due_idx").on(t.status, t.nextAttemptAt),
  }),
);

export type NotificationQueueRow = typeof notificationQueue.$inferSelect;
export type NewNotificationQueueRow = typeof notificationQueue.$inferInsert;
