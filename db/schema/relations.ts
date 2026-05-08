import { relations } from "drizzle-orm";
import { adminUsers, clientUsers } from "./auth";
import { clients, clientSettings } from "./clients";
import { providers, groupEntities } from "./providers";
import { payers } from "./payers";
import { enrollments } from "./enrollments";
import { comments, internalNotes } from "./comments";
import { documents } from "./documents";
import { statusHistory, activityEvents } from "./audit";

export const clientsRelations = relations(clients, ({ many, one }) => ({
  users: many(clientUsers),
  providers: many(providers),
  groupEntities: many(groupEntities),
  enrollments: many(enrollments),
  settings: one(clientSettings, {
    fields: [clients.id],
    references: [clientSettings.clientId],
  }),
}));

export const clientUsersRelations = relations(clientUsers, ({ one }) => ({
  client: one(clients, { fields: [clientUsers.clientId], references: [clients.id] }),
}));

export const providersRelations = relations(providers, ({ one, many }) => ({
  client: one(clients, { fields: [providers.clientId], references: [clients.id] }),
  enrollments: many(enrollments),
}));

export const groupEntitiesRelations = relations(groupEntities, ({ one, many }) => ({
  client: one(clients, { fields: [groupEntities.clientId], references: [clients.id] }),
  enrollments: many(enrollments),
}));

export const payersRelations = relations(payers, ({ many }) => ({
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  client: one(clients, { fields: [enrollments.clientId], references: [clients.id] }),
  provider: one(providers, { fields: [enrollments.providerId], references: [providers.id] }),
  groupEntity: one(groupEntities, {
    fields: [enrollments.groupEntityId],
    references: [groupEntities.id],
  }),
  payer: one(payers, { fields: [enrollments.payerId], references: [payers.id] }),
  parentEnrollment: one(enrollments, {
    fields: [enrollments.parentEnrollmentId],
    references: [enrollments.id],
    relationName: "recred_chain",
  }),
  childEnrollments: many(enrollments, { relationName: "recred_chain" }),
  comments: many(comments),
  internalNotes: many(internalNotes),
  statusHistory: many(statusHistory),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  client: one(clients, { fields: [comments.clientId], references: [clients.id] }),
  enrollment: one(enrollments, {
    fields: [comments.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const internalNotesRelations = relations(internalNotes, ({ one }) => ({
  client: one(clients, { fields: [internalNotes.clientId], references: [clients.id] }),
  enrollment: one(enrollments, {
    fields: [internalNotes.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, { fields: [documents.clientId], references: [clients.id] }),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [statusHistory.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  client: one(clients, { fields: [activityEvents.clientId], references: [clients.id] }),
}));

export const adminUsersRelations = relations(adminUsers, () => ({}));
