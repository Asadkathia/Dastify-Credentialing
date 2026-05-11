import { pgTable, uuid, text, timestamp, integer, date, boolean, index } from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { documentOwnerTypeEnum } from "./enums";
import { documentCategories } from "./document_categories";

// Polymorphic document table — owned by provider, enrollment, group_entity, or client.
// File contents live in Supabase Storage; this row is the metadata.
//
// `categoryId` references document_categories (admin-extensible at runtime).
// `legacyCategory` is the old enum value, retained for one release for recovery
// (see migration 0008). New code should not read or write it.
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    ownerType: documentOwnerTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => documentCategories.id, { onDelete: "restrict" }),
    legacyCategory: text("legacy_category"),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    expirationDate: date("expiration_date"),
    isInternal: boolean("is_internal").notNull().default(false),
    virusScanStatus: text("virus_scan_status").notNull().default("pending"),
    virusScanCompletedAt: timestamp("virus_scan_completed_at", { withTimezone: true }),
    uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index("documents_client_id_idx").on(t.clientId),
    ownerIdx: index("documents_owner_idx").on(t.ownerType, t.ownerId),
    expirationIdx: index("documents_expiration_idx").on(t.expirationDate),
    categoryIdx: index("documents_category_id_idx").on(t.categoryId),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
