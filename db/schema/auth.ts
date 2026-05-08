import { pgTable, uuid, timestamp, text, boolean, pgSchema } from "drizzle-orm/pg-core";
import { adminRoleEnum, clientUserRoleEnum } from "./enums";
import { clients } from "./clients";

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

// Client-side users (practice staff).
// Provisioned via admin invite; scoped to one client_id.
export const clientUsers = pgTable("client_users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: clientUserRoleEnum("role").notNull().default("client_viewer"),
  isActive: boolean("is_active").notNull().default(true),
  invitedByUserId: uuid("invited_by_user_id"),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type ClientUser = typeof clientUsers.$inferSelect;
