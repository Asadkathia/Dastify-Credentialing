import { describe, it } from "vitest";

describe("RLS: organization_users", () => {
  it.todo("platform admin sees every membership row");
  it.todo("org_admin sees only their own org's members");
  it.todo("org_viewer sees only their own org's members");
  it.todo("org_admin can invite a new org user into their own org");
  it.todo("org_admin CANNOT invite a user into a different org");
  it.todo("org_viewer cannot insert/update/delete any membership");
  it.todo("the supabase_auth_admin role can read for the JWT hook");
});
