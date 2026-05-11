import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { payerTypeEnum } from "./enums";

// Master list of insurance payers. Global (not tenant-scoped); shared across all clients.
export const payers = pgTable(
  "payers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    payerType: payerTypeEnum("payer_type").notNull().default("commercial"),
    statesActive: jsonb("states_active").$type<string[]>().notNull().default([]),
    websiteUrl: text("website_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("payers_name_idx").on(t.name),
  }),
);

export type Payer = typeof payers.$inferSelect;
export type NewPayer = typeof payers.$inferInsert;
