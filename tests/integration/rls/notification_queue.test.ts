import { beforeAll, describe, expect, it } from "vitest";
import { userClient, anonClient, adminClient } from "../helpers/clients";
import { seedFixture, type Seeded } from "../helpers/seed";

/**
 * RLS + enqueue-trigger enforcement for `notification_queue` (migration 0019).
 *
 * Access model: RLS enabled, NO policies → default-deny for anon/authenticated.
 * Only the service role (worker) and the owner role (migrations) can touch it.
 * No user session ever reads or writes the queue — it can contain cross-tenant
 * notification intent, so a leak here would cross tenant boundaries.
 *
 * Also covers the enqueue triggers: a comment insert and an enrollment status
 * change must each drop exactly one queue row, atomically with the data change.
 */
describe("RLS: notification_queue", () => {
  let s: Seeded;

  beforeAll(async () => {
    s = await seedFixture();
  });

  it("comment insert enqueues one 'comment' row (trg_enqueue_comment)", async () => {
    const admin = adminClient();
    const { data: comment, error: insErr } = await admin
      .from("comments")
      .insert({
        organization_id: s.orgA.id,
        enrollment_id: s.orgA.enrollmentIds[0],
        author_user_id: s.orgA.adminUser.id,
        body: "enqueue trigger test",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    const { data, error } = await admin
      .from("notification_queue")
      .select("kind, organization_id, comment_id, enrollment_id, status")
      .eq("comment_id", comment!.id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.kind).toBe("comment");
    expect(data?.[0]?.organization_id).toBe(s.orgA.id);
    expect(data?.[0]?.enrollment_id).toBe(s.orgA.enrollmentIds[0]);
    expect(data?.[0]?.status).toBe("pending");
  });

  it("enrollment status change enqueues a 'status_change' row with the transition payload", async () => {
    const admin = adminClient();
    const { error: upErr } = await admin
      .from("enrollments")
      .update({ status: "submitted" })
      .eq("id", s.orgA.enrollmentIds[1]);
    expect(upErr).toBeNull();

    const { data, error } = await admin
      .from("notification_queue")
      .select("kind, organization_id, payload")
      .eq("enrollment_id", s.orgA.enrollmentIds[1])
      .eq("kind", "status_change");
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const row = rows[rows.length - 1];
    expect(row?.organization_id).toBe(s.orgA.id);
    expect((row?.payload as { toStatus?: string })?.toStatus).toBe("submitted");
  });

  it("org_admin cannot read the queue (RLS default-deny)", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { data } = await c.from("notification_queue").select("id");
    // No policy → either a permission/RLS error (data null) or zero rows.
    // Either way, nothing leaks.
    expect(data?.length ?? 0).toBe(0);
  });

  it("org_viewer cannot read the queue", async () => {
    const c = userClient(s.orgA.viewerUser.token);
    const { data } = await c.from("notification_queue").select("id");
    expect(data?.length ?? 0).toBe(0);
  });

  it("an org user from another tenant cannot read the queue either", async () => {
    const c = userClient(s.orgB.adminUser.token);
    const { data } = await c.from("notification_queue").select("id");
    expect(data?.length ?? 0).toBe(0);
  });

  it("anonymous (logged-out) cannot read the queue", async () => {
    const c = anonClient();
    const { data } = await c.from("notification_queue").select("id");
    expect(data?.length ?? 0).toBe(0);
  });

  it("org_admin cannot insert into the queue (write denied)", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { error } = await c.from("notification_queue").insert({
      kind: "comment",
      organization_id: s.orgA.id,
      enrollment_id: s.orgA.enrollmentIds[0],
    });
    expect(error).not.toBeNull();
  });

  it("org_admin cannot update or delete queue rows", async () => {
    const admin = adminClient();
    const { data: row } = await admin
      .from("notification_queue")
      .select("id")
      .limit(1)
      .single();
    expect(row?.id).toBeTruthy();

    const c = userClient(s.orgA.adminUser.token);
    const { data: updated } = await c
      .from("notification_queue")
      .update({ status: "sent" })
      .eq("id", row!.id)
      .select("id");
    expect(updated?.length ?? 0).toBe(0);

    const { data: deleted } = await c
      .from("notification_queue")
      .delete()
      .eq("id", row!.id)
      .select("id");
    expect(deleted?.length ?? 0).toBe(0);
  });

  it("service role can read the queue (the worker path)", async () => {
    const admin = adminClient();
    const { data, error } = await admin.from("notification_queue").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("claim_notification_batch leases pending rows (bumps attempts, pushes next_attempt_at)", async () => {
    const admin = adminClient();
    const { data, error } = await admin.rpc("claim_notification_batch", { batch_limit: 50 });
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const row of (data ?? []) as Array<{ attempts: number; next_attempt_at: string }>) {
      expect(row.attempts).toBeGreaterThanOrEqual(1);
      expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("claim_notification_batch is not callable by an org user", async () => {
    const c = userClient(s.orgA.adminUser.token);
    const { error } = await c.rpc("claim_notification_batch", { batch_limit: 5 });
    expect(error).not.toBeNull();
  });
});
