import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { digestFrequencyEnum } from "./enums";

// A client is a healthcare practice / group that Dastify provides credentialing services for.
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Per-client portal config: banner text, notification toggles.
export const clientSettings = pgTable("client_settings", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  disclaimerBannerText: text("disclaimer_banner_text")
    .notNull()
    .default("All Insurances take up to 90-120 business days for processing."),
  digestEmailFrequency: digestFrequencyEnum("digest_email_frequency").notNull().default("weekly"),
  notifyOnStatusChange: boolean("notify_on_status_change").notNull().default(true),
  notifyOnDocumentExpiration: boolean("notify_on_document_expiration").notNull().default(true),
  expirationAlertDaysBefore: integer("expiration_alert_days_before").notNull().default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientSettings = typeof clientSettings.$inferSelect;
