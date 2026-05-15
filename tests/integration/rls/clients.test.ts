import { describe, it } from "vitest";

/**
 * RLS isolation for `clients` (clinicians, post-0013 rename).
 * Covers encrypted columns (dea_number_encrypted, ssn_last4_encrypted,
 * dob_encrypted) — even visible to admins these stay bytea-only at this
 * layer; plaintext access is via the decrypt helpers tested separately.
 */
describe("RLS: clients (clinicians)", () => {
  it.todo("platform admin sees clinicians across orgs");
  it.todo("org_admin sees only their own org's clinicians");
  it.todo("org_admin cannot fetch another org's clinician by id");
  it.todo("org_admin cannot insert a clinician (admin-only)");
  it.todo("org_admin cannot update their own org's clinician");
  it.todo("org_admin cannot read encrypted columns as plaintext via SELECT");
});
