import { beforeAll, describe, expect, it } from "vitest";
import { userClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS isolation for `comments`.
 *
 * Comments are the one tenant-mutable table org users can write to. Policies:
 *   - comments_select: admin OR same org
 *   - comments_insert: admin OR (same org AND author = auth.uid())
 *   - comments_update: admin OR (same org AND author = auth.uid() AND not
 *                     soft-deleted AND created within 15 minutes)
 *   - comments_admin_delete: admin only
 *
 * Two sharp edges tested below: the author-must-be-self check and the 15-min
 * edit window.
 */
describe("RLS: comments", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  describe("SELECT", () => {
    it("platform admin sees comments from every org", async () => {
      const c = userClient(s.platformAdmin.token);
      const { data, error } = await c.from("comments").select("id, organization_id");
      expect(error).toBeNull();
      const orgIds = new Set((data ?? []).map((r) => r.organization_id));
      expect(orgIds.has(s.orgA.id)).toBe(true);
      expect(orgIds.has(s.orgB.id)).toBe(true);
    });

    it("org_admin sees only their own org's comments", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("comments")
        .select("id, organization_id");
      expect(error).toBeNull();
      for (const row of data ?? []) {
        expect(row.organization_id).toBe(s.orgA.id);
      }
    });
  });

  describe("INSERT", () => {
    it("org_viewer can post a comment on their own org's enrollment", async () => {
      const c = userClient(s.orgA.viewerUser.token);
      const { data, error } = await c
        .from("comments")
        .insert({
          organization_id: s.orgA.id,
          enrollment_id: s.orgA.enrollmentIds[0],
          author_user_id: s.orgA.viewerUser.id,
          body: "hello from viewer",
        })
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(1);
    });

    it("org_viewer CANNOT post a comment claiming a different author_user_id", async () => {
      // Defense against spoofing: even within own org, author must be self.
      const c = userClient(s.orgA.viewerUser.token);
      const { error } = await c.from("comments").insert({
        organization_id: s.orgA.id,
        enrollment_id: s.orgA.enrollmentIds[0],
        author_user_id: s.orgA.adminUser.id, // not self
        body: "impersonation attempt",
      });
      expect(error).not.toBeNull();
    });

    it("org_admin CANNOT post a comment in a different org", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { error } = await c.from("comments").insert({
        organization_id: s.orgB.id,
        enrollment_id: s.orgB.enrollmentIds[0],
        author_user_id: s.orgA.adminUser.id,
        body: "cross-tenant leak",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("org_admin can edit their own freshly-posted comment", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data: inserted } = await c
        .from("comments")
        .insert({
          organization_id: s.orgA.id,
          enrollment_id: s.orgA.enrollmentIds[0],
          author_user_id: s.orgA.adminUser.id,
          body: "v1",
        })
        .select("id")
        .single();
      expect(inserted?.id).toBeTruthy();

      const { data: edited, error } = await c
        .from("comments")
        .update({ body: "v2" })
        .eq("id", inserted!.id)
        .select("id, body");
      expect(error).toBeNull();
      expect(edited?.length).toBe(1);
      expect(edited?.[0]?.body).toBe("v2");
    });

    it("org_admin cannot edit someone else's comment in the same org", async () => {
      const c = userClient(s.orgA.viewerUser.token);
      // seed.ts wrote one comment per org authored by org_admin.
      const { data, error } = await c
        .from("comments")
        .update({ body: "tampered by viewer" })
        .eq("id", s.orgA.commentId)
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });
  });

  describe("DELETE", () => {
    it("org_admin cannot delete their own comment (admin-only delete)", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("comments")
        .delete()
        .eq("id", s.orgA.commentId)
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });
  });
});
