import { relations } from "drizzle-orm";
import { adminUsers, organizationUsers } from "./auth";
import { organizations, organizationSettings } from "./organizations";
import { clients } from "./clients";
import { payers } from "./payers";
import { enrollments } from "./enrollments";
import { comments, internalNotes } from "./comments";
import { documents } from "./documents";
import { documentCategories } from "./document_categories";
import { statusHistory, activityEvents } from "./audit";

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(organizationUsers),
  clients: many(clients),
  enrollments: many(enrollments),
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
  }),
}));

export const organizationUsersRelations = relations(organizationUsers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationUsers.organizationId],
    references: [organizations.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  enrollments: many(enrollments),
}));

export const payersRelations = relations(payers, ({ many }) => ({
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [enrollments.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, { fields: [enrollments.clientId], references: [clients.id] }),
  payer: one(payers, { fields: [enrollments.payerId], references: [payers.id] }),
  comments: many(comments),
  internalNotes: many(internalNotes),
  statusHistory: many(statusHistory),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  organization: one(organizations, {
    fields: [comments.organizationId],
    references: [organizations.id],
  }),
  enrollment: one(enrollments, {
    fields: [comments.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const internalNotesRelations = relations(internalNotes, ({ one }) => ({
  organization: one(organizations, {
    fields: [internalNotes.organizationId],
    references: [organizations.id],
  }),
  enrollment: one(enrollments, {
    fields: [internalNotes.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, {
    fields: [documents.organizationId],
    references: [organizations.id],
  }),
  category: one(documentCategories, {
    fields: [documents.categoryId],
    references: [documentCategories.id],
  }),
}));

export const documentCategoriesRelations = relations(documentCategories, ({ many }) => ({
  documents: many(documents),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [statusHistory.enrollmentId],
    references: [enrollments.id],
  }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityEvents.organizationId],
    references: [organizations.id],
  }),
}));

export const adminUsersRelations = relations(adminUsers, () => ({}));
