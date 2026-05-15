import { beforeAll, describe, expect, it } from "vitest";
import { userClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS isolation for `documents`.
 *
 * `documents_select` reads: admin OR (same org AND is_internal=false AND
 * deleted_at IS NULL). CLAUDE.md rule 3: internal documents never returned to
 * a client session. CRUD other than SELECT is admin-only.
 */
describe("RLS: documents", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  it("platform admin sees every document, public and internal", async () => {
    const c = userClient(s.platformAdmin.token);
    const { data, error } = await c.from("documents").select("id, is_internal");
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((r) => r.id));
    expect(ids.has(s.orgA.publicDocId)).toBe(true);
    expect(ids.has(s.orgA.internalDocId)).toBe(true);
    expect(ids.has(s.orgB.publicDocId)).toBe(true);
    expect(ids.has(s.orgB.internalDocId)).toBe(true);
  });

  it("org_admin sees own org's PUBLIC documents only", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("documents")
      .select("id, organization_id, is_internal");
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    const row = data?.[0];
    expect(row?.id).toBe(s.orgA.publicDocId);
    expect(row?.is_internal).toBe(false);
  });

  it("org_admin cannot fetch own org's INTERNAL document by id", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("documents")
      .select("id")
      .eq("id", s.orgA.internalDocId);
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_viewer cannot see another org's documents at all", async () => {
    const c = userClient(s.orgA.viewerUser.token);
    const { data, error } = await c
      .from("documents")
      .select("id")
      .eq("organization_id", s.orgB.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  it("org_admin cannot insert a document (admin-only)", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { error } = await c.from("documents").insert({
      organization_id: s.orgA.id,
      owner_type: "enrollment",
      owner_id: s.orgA.enrollmentIds[0],
      category_id: s.categoryId,
      file_name: "leak.pdf",
      storage_path: `${s.orgA.id}/leak.pdf`,
      mime_type: "application/pdf",
      size_bytes: 1,
      uploaded_by_user_id: s.orgA.adminUser.id,
    });
    expect(error).not.toBeNull();
  });

  it("org_admin cannot flip is_internal on their org's public document", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("documents")
      .update({ is_internal: true })
      .eq("id", s.orgA.publicDocId)
      .select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });
});
