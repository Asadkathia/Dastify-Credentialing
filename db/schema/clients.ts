import { pgTable, uuid, text, timestamp, jsonb, customType, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// Encrypted text column type — stored as bytea in DB, accessed via pgcrypto helpers.
// We treat it as bytea on the JS side; reads happen through SQL functions that decrypt.
const encryptedText = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
});

// A client is the individual clinician (a person) belonging to an organization.
// Every enrollment hangs off a client_id; there is no separate group subject
// (migration 0018 removed the group_entities table).
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    suffix: text("suffix"),
    npi: text("npi"),
    primarySpecialty: text("primary_specialty"),
    secondarySpecialty: text("secondary_specialty"),
    caqhId: text("caqh_id"),
    email: text("email"),
    phone: text("phone"),
    licenseStates: jsonb("license_states")
      .$type<Array<{ state: string; licenseNumber: string; expiration: string | null }>>()
      .notNull()
      .default([]),
    deaNumberEncrypted: encryptedText("dea_number_encrypted"),
    ssnLast4Encrypted: encryptedText("ssn_last4_encrypted"),
    dobEncrypted: encryptedText("dob_encrypted"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    organizationIdx: index("clients_organization_id_idx").on(t.organizationId),
    nameIdx: index("clients_name_idx").on(t.lastName, t.firstName),
  }),
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
