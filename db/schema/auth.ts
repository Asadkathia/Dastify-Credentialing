import { pgTable, uuid, timestamp, text, boolean, pgSchema } from "drizzle-orm/pg-core";
import { adminRoleEnum, organizationUserRoleEnum } from "./enums";
import { organizations } from "./organizations";

// Reference to Supabase's built-in auth.users table.
// We don't manage this; it's owned by Supabase Auth.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});

// Internal staff users.
// One row per Dastify employee with portal access.
export const adminUsers = pgTable("admin_users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: adminRoleEnum("role").notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Organization-side users (practice staff).
// Provisioned via admin invite; scoped to one organization_id.
export const organizationUsers = pgTable("organization_users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: organizationUserRoleEnum("role").notNull().default("org_viewer"),
  isActive: boolean("is_active").notNull().default(true),
  invitedByUserId: uuid("invited_by_user_id"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type OrganizationUser = typeof organizationUsers.$inferSelect;
