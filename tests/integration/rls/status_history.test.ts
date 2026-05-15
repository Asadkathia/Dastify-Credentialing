import { beforeAll, describe, expect, it } from "vitest";
import { userClient, adminClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS + append-only enforcement for `status_history`.
 *
 * Policies:
 *   - status_history_select: admin OR same org
 *   - status_history_admin_insert: admin only (the audit trigger uses
 *     SECURITY DEFINER and bypasses this, but direct INSERTs are gated)
 *   - no UPDATE or DELETE policies — append-only by design (rule 6)
 *   - DB triggers `trg_status_history_no_update` block UPDATE/DELETE outright
 *
 * Also covers migration 0017: a status change writes a status_history row
 * (rule 19). If that ever regresses, every test here fails together — the
 * audit pipeline is load-bearing for the entire enrollment lifecycle.
 */
describe("RLS: status_history", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  it("seed creates one 'created' row per enrollment (rule 19)", async () => {
    const admin = adminClient();
    const { data, error } = await admin
      .from("status_history")
      .select("enrollment_id, to_status, reason")
      .eq("organization_id", s.orgA.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(2); // one per enrollment
    for (const row of data ?? []) {
      expect(row.to_status).toBe("prep");
      expect(row.reason).toBe("created");
    }
  });

  it("platform admin sees history from every org", async () => {
    const c = userClient(s.platformAdmin.token);
    const { data, error } = await c
      .from("status_history")
      .select("id, organization_id");
    expect(error).toBeNull();
    const orgIds = new Set((data ?? []).map((r) => r.organization_id));
    expect(orgIds.has(s.orgA.id)).toBe(true);
    expect(orgIds.has(s.orgB.id)).toBe(true);
  });

  it("org_admin sees only their own org's history", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data, error } = await c
      .from("status_history")
      .select("organization_id");
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.organization_id).toBe(s.orgA.id);
    }
  });

  it("org_admin cannot insert into status_history directly", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { error } = await c.from("status_history").insert({
      organization_id: s.orgA.id,
      enrollment_id: s.orgA.enrollmentIds[0],
      to_status: "approved",
      changed_by_user_id: s.orgA.adminUser.id,
      reason: "should not land",
    });
    expect(error).not.toBeNull();
  });

  it("the append-only trigger blocks UPDATE even for service-role", async () => {
    // Append-only is enforced at the trigger layer, not just RLS. Even a
    // service-role connection must be denied.
    const admin = adminClient();
    const { data: existing } = await admin
      .from("status_history")
      .select("id")
      .eq("organization_id", s.orgA.id)
      .limit(1)
      .single();
    expect(existing?.id).toBeTruthy();

    const { error } = await admin
      .from("status_history")
      .update({ reason: "tampered" })
      .eq("id", existing!.id);
    expect(error).not.toBeNull();
  });

  it("the append-only trigger blocks DELETE even for service-role", async () => {
    const admin = adminClient();
    const { data: existing } = await admin
      .from("status_history")
      .select("id")
      .eq("organization_id", s.orgA.id)
      .limit(1)
      .single();
    expect(existing?.id).toBeTruthy();

    const { error } = await admin
      .from("status_history")
      .delete()
      .eq("id", existing!.id);
    expect(error).not.toBeNull();
  });

  it("changing enrollment.status writes a new status_history row with correct organization_id (migration 0017 guard)", async () => {
    // Migration 0017 fixed the trigger that was referencing the pre-rename
    // column. This test is the regression net: if the trigger ever drifts
    // again, status mutations either error or write the wrong org_id.
    const admin = adminClient();
    const { error: upErr } = await admin
      .from("enrollments")
      .update({ status: "submitted" })
      .eq("id", s.orgA.enrollmentIds[1]);
    expect(upErr).toBeNull();

    const { data: rows, error: histErr } = await admin
      .from("status_history")
      .select("organization_id, from_status, to_status")
      .eq("enrollment_id", s.orgA.enrollmentIds[1])
      .order("changed_at", { ascending: false })
      .limit(1);
    expect(histErr).toBeNull();
    expect(rows?.length).toBe(1);
    const row = rows?.[0];
    expect(row?.organization_id).toBe(s.orgA.id);
    expect(row?.from_status).toBe("prep");
    expect(row?.to_status).toBe("submitted");
  });
});
