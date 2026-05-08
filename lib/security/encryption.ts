import "server-only";
import { sql } from "drizzle-orm";

/**
 * Helpers that wrap pgcrypto's symmetric encryption for column-level encrypted
 * sensitive data: DEA numbers, SSN-last-4, DOB, Tax ID.
 *
 * Storage format: bytea, produced by `pgp_sym_encrypt(plaintext, key)`.
 * Decryption: `pgp_sym_decrypt(ciphertext::bytea, key)`.
 *
 * The key lives in the env var PGCRYPTO_SYMMETRIC_KEY. NEVER log it. Rotating
 * the key requires re-encrypting all rows (out of scope for v1; build the
 * rotation script when the first rotation is due).
 *
 * IMPORTANT: never call the decrypt helper from a route that returns the value
 * to a client user. Decryption is only valid in server-only contexts that
 * intentionally surface the value (e.g., admin "view sensitive details" screen
 * with explicit MFA re-prompt — TODO).
 */

function getKey(): string {
  const key = process.env.PGCRYPTO_SYMMETRIC_KEY;
  if (!key) {
    throw new Error("PGCRYPTO_SYMMETRIC_KEY is not set");
  }
  if (key.length < 32) {
    throw new Error("PGCRYPTO_SYMMETRIC_KEY must be at least 32 characters");
  }
  return key;
}

/**
 * Returns a SQL fragment that encrypts the given plaintext value at insert/update time.
 * Use as: `db.update(providers).set({ deaNumberEncrypted: encryptColumn(value) })`
 */
export function encryptColumn(plaintext: string | null | undefined) {
  if (plaintext == null || plaintext === "") {
    return sql`NULL`;
  }
  const key = getKey();
  return sql`pgp_sym_encrypt(${plaintext}, ${key})`;
}

/**
 * Returns a SQL fragment that decrypts a bytea column. Used in SELECT.
 * Use as: `db.select({ dea: decryptColumn(providers.deaNumberEncrypted) })`
 */
export function decryptColumn(column: unknown) {
  const key = getKey();
  // The Drizzle column reference is interpolated as an identifier via sql.
  return sql<string | null>`CASE WHEN ${column} IS NULL THEN NULL ELSE pgp_sym_decrypt(${column}::bytea, ${key}) END`;
}
