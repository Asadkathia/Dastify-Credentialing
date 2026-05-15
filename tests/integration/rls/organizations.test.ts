import { describe, it } from "vitest";

/**
 * RLS isolation for `organizations`.
 *
 * Policies: admin CRUD + tenant select-own.
 * Higher-leverage tables are tested first; flesh this out when promoting the
 * suite from "load-bearing" to "comprehensive".
 */
describe("RLS: organizations", () => {
  it.todo("platform admin sees every organization");
  it.todo("org_admin sees only their own organization row");
  it.todo("org_admin cannot fetch another organization by id");
  it.todo("org_admin cannot insert a new organization");
  it.todo("org_admin cannot update their own organization (admin-only)");
  it.todo("org_admin cannot soft-delete their own organization");
});
