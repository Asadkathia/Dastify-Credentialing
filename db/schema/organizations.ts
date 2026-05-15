import { pgTable, uuid, text, timestamp, boolean, integer, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { digestFrequencyEnum } from "./enums";

// kind ∈ {group, individual}. `group` is the existing multi-clinician practice
// model. `individual` is a solo clinician — auto-managed singleton in `clients`,
// enforced by a constraint trigger (see migration 0018). Kind is immutable in v1.
export type OrganizationKind = "group" | "individual";

// An organization is a healthcare practice / group that Dastify provides
// credentialing services for (the tenant in our multi-tenant model).
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    kind: text("kind").$type<OrganizationKind>().notNull().default("group"),
    primaryContactName: text("primary_contact_name"),
    primaryContactEmail: text("primary_contact_email"),
    primaryContactPhone: text("primary_contact_phone"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    kindCheck: check("organizations_kind_check", sql`${t.kind} IN ('group','individual')`),
  }),
);

// Per-organization portal config: banner text, notification toggles.
export const organizationSettings = pgTable("organization_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  disclaimerBannerText: text("disclaimer_banner_text")
    .notNull()
    .default("All Insurances take up to 90-120 business days for processing."),
  digestEmailFrequency: digestFrequencyEnum("digest_email_frequency").notNull().default("weekly"),
  notifyOnStatusChange: boolean("notify_on_status_change").notNull().default(true),
  notifyOnDocumentExpiration: boolean("notify_on_document_expiration").notNull().default(true),
  expirationAlertDaysBefore: integer("expiration_alert_days_before").notNull().default(60),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
