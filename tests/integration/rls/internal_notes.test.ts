import { beforeAll, describe, expect, it } from "vitest";
import { userClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS isolation for `internal_notes` — admin-only by CLAUDE.md rule 3.
 *
 * Policy under test: `internal_notes_admin_select` only. There is NO tenant
 * select policy. This is the "double-defense" table: org users must never see
 * any row, not even their own org's.
 */
describe("RLS: internal_notes (admin-only)", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  it("platform admin sees notes from every org", async () => {
    const c = userClient(s.platformAdmin.token);
    const { data, error } = await c.from("internal_notes").select("id, organization_id");
    expect(error).toBeNull();
    const orgIds = new Set((data ?? []).map((r) => r.organization_id));
    expect(orgIds.has(s.orgA.id)).toBe(true);
    expect(orgIds.has(s.orgB.id)).toBe(true);
  });

  it("org_admin sees ZERO internal notes for their own org", async () => {
    // Rule 3: internal_notes never leak to client sessions.
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c.from("internal_notes").select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_viewer sees zero internal notes", async () => {
    const c = userClient(s.orgA.viewerUser.token);
    const { data, error } = await c.from("internal_notes").select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_admin cannot fetch a specific internal note by id even for their own org", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("internal_notes")
      .select("id, body")
      .eq("id", s.orgA.internalNoteId);
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_admin cannot insert an internal note (admin-only insert)", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { error } = await c.from("internal_notes").insert({
      organization_id: s.orgA.id,
      enrollment_id: s.orgA.enrollmentIds[0],
      author_user_id: s.orgA.adminUser.id,
      body: "should never land",
    });
    expect(error).not.toBeNull();
  });

  it("org_admin cannot update an internal note", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("internal_notes")
      .update({ body: "tampered" })
      .eq("id", s.orgA.internalNoteId)
      .select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_admin cannot delete an internal note", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("internal_notes")
      .delete()
      .eq("id", s.orgA.internalNoteId)
      .select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });
});
