import { pgTable, uuid, text, timestamp, jsonb, customType, index } from "drizzle-orm/pg-core";
import { clients } from "./clients";

// Encrypted text column type — stored as bytea in DB, accessed via pgcrypto helpers.
// We treat it as bytea on the JS side; reads happen through SQL functions that decrypt.
const encryptedText = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
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
    clientIdx: index("providers_client_id_idx").on(t.clientId),
    nameIdx: index("providers_name_idx").on(t.lastName, t.firstName),
  }),
);

// Group enrollments (the practice itself enrolls under a group NPI/Tax ID).
export const groupEntities = pgTable(
  "group_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    legalName: text("legal_name").notNull(),
    dbaName: text("dba_name"),
    groupNpi: text("group_npi"),
    taxonomyCode: text("taxonomy_code"),
    taxIdEncrypted: encryptedText("tax_id_encrypted"),
    addresses: jsonb("addresses")
      .$type<
        Array<{
          type: "service" | "billing" | "mailing";
          line1: string;
          line2?: string;
          city: string;
          state: string;
          zip: string;
        }>
      >()
      .notNull()
      .default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index("group_entities_client_id_idx").on(t.clientId),
  }),
);

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
export type GroupEntity = typeof groupEntities.$inferSelect;
export type NewGroupEntity = typeof groupEntities.$inferInsert;
