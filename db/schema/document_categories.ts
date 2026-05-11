import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

// Document categories — admin-extensible at runtime.
// 11 default categories are seeded by migration 0008. Admins can add more.
export const documentCategories = pgTable(
  "document_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(999),
    isDefault: boolean("is_default").notNull().default(false),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sortIdx: index("document_categories_sort_order_idx").on(t.sortOrder),
  }),
);

export type DocumentCategory = typeof documentCategories.$inferSelect;
export type NewDocumentCategory = typeof documentCategories.$inferInsert;
