import { describe, it } from "vitest";

describe("RLS: organization_settings", () => {
  it.todo("platform admin sees settings for every org");
  it.todo("org_admin sees only their own org's settings");
  it.todo("org_admin cannot read another org's settings by org_id");
  it.todo("org_admin cannot update their own settings (admin-only)");
  it.todo("org_admin cannot insert a settings row for any org");
});
