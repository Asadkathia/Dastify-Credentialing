import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, userClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * Tests for migration 0018:
 *   - `organizations.kind ∈ {group, individual}` (immutable in v1)
 *   - `enforce_individual_org_single_client` constraint trigger
 *   - `create_individual_organization(...)` RPC
 *   - Cross-tenant RLS for orgs (incl. `kind`) and the auto-managed singleton
 *     clinician of an individual org
 *
 * Each test uses a fresh seed via the standard fixture; ad-hoc orgs/clients
 * are inserted via the service-role admin client so trigger behavior — not RLS
 * — is what's under test where indicated.
 */
describe("organization kind + group_entities removal (migration 0018)", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  describe("trigger: individual org single-clinician invariant", () => {
    it("allows exactly one active client; rejects a second; allows after soft-delete", async () => {
      const admin = adminClient();

      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .insert({
          legal_name: "Solo Practitioner LLC (single)",
          display_name: "Solo Single",
          kind: "individual",
        })
        .select("id")
        .single();
      expect(orgErr).toBeNull();
      expect(org).not.toBeNull();
      const orgId = org!.id;

      await admin.from("organization_settings").insert({ organization_id: orgId }).throwOnError();

      // First clinician — should succeed.
      const { data: clin1, error: clin1Err } = await admin
        .from("clients")
        .insert({ organization_id: orgId, first_name: "Solo", last_name: "First" })
        .select("id")
        .single();
      expect(clin1Err).toBeNull();
      expect(clin1).not.toBeNull();

      // Second clinician — trigger must reject.
      const { error: clin2Err } = await admin
        .from("clients")
        .insert({ organization_id: orgId, first_name: "Solo", last_name: "Second" });
      expect(clin2Err).not.toBeNull();
      expect((clin2Err?.message ?? "").toLowerCase()).toMatch(/individual|trigger/);

      // Soft-delete the first clinician, then insert a fresh active one.
      const { error: deleteErr } = await admin
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", clin1!.id);
      expect(deleteErr).toBeNull();

      const { error: clin3Err } = await admin
        .from("clients")
        .insert({ organization_id: orgId, first_name: "Solo", last_name: "Third" });
      expect(clin3Err).toBeNull();
    });

    it("fires on UPDATE OF organizations.kind — flipping a group with >1 client to individual is rejected", async () => {
      const admin = adminClient();

      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .insert({
          legal_name: "Flip Practice LLC",
          display_name: "Flip Practice",
          kind: "group",
        })
        .select("id")
        .single();
      expect(orgErr).toBeNull();
      expect(org).not.toBeNull();
      const orgId = org!.id;

      await admin.from("organization_settings").insert({ organization_id: orgId }).throwOnError();

      const { error: insErr } = await admin
        .from("clients")
        .insert([
          { organization_id: orgId, first_name: "Group", last_name: "One" },
          { organization_id: orgId, first_name: "Group", last_name: "Two" },
        ]);
      expect(insErr).toBeNull();

      // Try to flip kind → individual. Trigger must reject.
      const { error: flipErr } = await admin
        .from("organizations")
        .update({ kind: "individual" })
        .eq("id", orgId);
      expect(flipErr).not.toBeNull();
      expect((flipErr?.message ?? "").toLowerCase()).toMatch(/individual|trigger/);
    });
  });

  describe("RPC: create_individual_organization", () => {
    it("creates organization + settings + singleton clinician atomically", async () => {
      const admin = adminClient();

      const { data: rpcData, error: rpcErr } = await admin.rpc(
        "create_individual_organization",
        {
          p_legal_name: "Dr Solo PLLC",
          p_display_name: "Dr Solo",
          p_primary_contact_name: "Dr Solo",
          p_primary_contact_email: "solo@rls.test",
          p_primary_contact_phone: "555-0001",
          p_notes: "",
          p_first_name: "Solonia",
          p_middle_name: "",
          p_last_name: "Doe",
          p_suffix: "",
          p_npi: "1234567890",
          p_primary_specialty: "Family Medicine",
          p_secondary_specialty: "",
          p_email: "solo.doe@rls.test",
          p_phone: "555-0002",
          p_caqh_id: "",
        },
      );
      expect(rpcErr).toBeNull();
      expect(rpcData).toBeTruthy();
      const newOrgId = String(rpcData);

      const { data: orgRow, error: orgErr } = await admin
        .from("organizations")
        .select("id, kind, legal_name, display_name")
        .eq("id", newOrgId)
        .single();
      expect(orgErr).toBeNull();
      expect(orgRow?.kind).toBe("individual");
      expect(orgRow?.legal_name).toBe("Dr Solo PLLC");

      const { data: settingsRow, error: setErr } = await admin
        .from("organization_settings")
        .select("organization_id")
        .eq("organization_id", newOrgId)
        .single();
      expect(setErr).toBeNull();
      expect(settingsRow?.organization_id).toBe(newOrgId);

      const { data: clinRows, error: clinErr } = await admin
        .from("clients")
        .select("id, first_name, last_name, organization_id, deleted_at")
        .eq("organization_id", newOrgId);
      expect(clinErr).toBeNull();
      expect(clinRows?.length).toBe(1);
      expect(clinRows?.[0]?.first_name).toBe("Solonia");
      expect(clinRows?.[0]?.last_name).toBe("Doe");
      expect(clinRows?.[0]?.deleted_at).toBeNull();
    });
  });

  describe("cross-tenant RLS for kind + individual-org singleton clinician", () => {
    it("org_admin from Org A cannot read Org B's row (including its kind)", async () => {
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("organizations")
        .select("id, kind")
        .eq("id", s.orgB.id);
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });

    it("org_admin from Org A cannot read the singleton clinician of a separate individual Org C", async () => {
      const admin = adminClient();

      // Provision an unrelated individual org via the RPC.
      const { data: rpcData, error: rpcErr } = await admin.rpc(
        "create_individual_organization",
        {
          p_legal_name: "Isolated Solo PLLC",
          p_display_name: "Isolated Solo",
          p_primary_contact_name: "",
          p_primary_contact_email: "",
          p_primary_contact_phone: "",
          p_notes: "",
          p_first_name: "Iso",
          p_middle_name: "",
          p_last_name: "Lated",
          p_suffix: "",
          p_npi: "",
          p_primary_specialty: "",
          p_secondary_specialty: "",
          p_email: "",
          p_phone: "",
          p_caqh_id: "",
        },
      );
      expect(rpcErr).toBeNull();
      const orgCId = String(rpcData);

      const { data: clinRows } = await admin
        .from("clients")
        .select("id")
        .eq("organization_id", orgCId);
      expect(clinRows?.length).toBe(1);
      const clinId = clinRows![0]!.id;

      // Org A's admin must not be able to read that singleton clinician.
      const c = userClient(s.orgA.adminUser.token);
      const { data, error } = await c
        .from("clients")
        .select("id, first_name, last_name, organization_id")
        .eq("id", clinId);
      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });
  });
});
