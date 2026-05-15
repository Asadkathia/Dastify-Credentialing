import { beforeAll, describe, expect, it } from "vitest";
import { userClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS isolation for `enrollments` — the core domain table.
 *
 * Policies under test (migration 0013):
 *   - enrollments_select        : admin OR same-org
 *   - enrollments_admin_insert  : admin only
 *   - enrollments_admin_update  : admin only
 *   - enrollments_admin_delete  : admin only
 */
describe("RLS: enrollments", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  describe("SELECT", () => {
    it("platform admin sees enrollments from every org", async () => {
      const c = userClient(s.platformAdmin.token);
      const { data, error } = await c.from("enrollments").select("id, organization_id");
      expect(error).toBeNull();
      const orgIds = new Set((data ?? []).map((r) => r.organization_id));
      expect(orgIds.has(s.orgA.id)).toBe(true);
      expect(orgIds.has(s.orgB.id)).toBe(true);
    });

    it("org_admin sees only their own org's enrollments", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c.from("enrollments").select("id, organization_id");
      expect(error).toBeNull();
      expect(data?.length).toBe(2);
      for (const row of data ?? []) {
        expect(row.organization_id).toBe(s.orgA.id);
      }
    });

    it("org_viewer sees only their own org's enrollments", async () => {
      const c = userClient(s.orgA.viewerUser.token);
      const { data, error } = await c.from("enrollments").select("id, organization_id");
      expect(error).toBeNull();
      expect(data?.length).toBe(2);
      for (const row of data ?? []) {
        expect(row.organization_id).toBe(s.orgA.id);
      }
    });

    it("org_admin sees zero rows when filtering for another org's id", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("enrollments")
        .select("id")
        .eq("organization_id", s.orgB.id);
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });
  });

  describe("INSERT", () => {
    it("org_admin cannot insert an enrollment into their own org", async () => {
      // Admin-only by policy — rule 23 destructive actions require admin.
      const c = userClient(s.orgA.adminUser.token);
      const { error } = await c.from("enrollments").insert({
        organization_id: s.orgA.id,
        client_id: s.orgA.clinicianIds[0],
        payer_id: s.payerId,
        state: "CA",
      });
      expect(error).not.toBeNull();
    });

    it("org_admin cannot insert an enrollment into a different org", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { error } = await c.from("enrollments").insert({
        organization_id: s.orgB.id,
        client_id: s.orgB.clinicianIds[0],
        payer_id: s.payerId,
        state: "NY",
      });
      expect(error).not.toBeNull();
    });

    it("platform admin can insert enrollments for any org", async () => {
      const c = userClient(s.platformAdmin.token);
      const { error } = await c.from("enrollments").insert({
        organization_id: s.orgA.id,
        client_id: s.orgA.clinicianIds[0],
        payer_id: s.payerId,
        state: "CA",
      });
      expect(error).toBeNull();
    });
  });

  describe("UPDATE", () => {
    it("org_admin cannot update an enrollment in their own org", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("enrollments")
        .update({ sub_status: "tampered" })
        .eq("id", s.orgA.enrollmentIds[0])
        .select("id");
      // RLS denies silently for UPDATE: error is null, affected rows = 0.
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });

    it("org_admin cannot update an enrollment in another org", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("enrollments")
        .update({ sub_status: "tampered" })
        .eq("id", s.orgB.enrollmentIds[0])
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });
  });

  describe("DELETE", () => {
    it("org_admin cannot delete an enrollment", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("enrollments")
        .delete()
        .eq("id", s.orgA.enrollmentIds[0])
        .select("id");
      expect(error).toBeNull();
      expect(data?.length).toBe(0);

      // Confirm it still exists when admin reads it back.
      const admin = userClient(s.platformAdmin.token);
      const { data: stillThere } = await admin
        .from("enrollments")
        .select("id")
        .eq("id", s.orgA.enrollmentIds[0]);
      expect(stillThere?.length).toBe(1);
    });
  });
});
