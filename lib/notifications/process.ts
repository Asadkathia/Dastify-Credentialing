import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { renderStatusChange, renderComment } from "./render";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type QueueRow = {
  id: string;
  kind: string;
  organization_id: string | null;
  enrollment_id: string | null;
  comment_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export type DrainResult = {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
};

async function markSent(supabase: AdminClient, id: string) {
  await supabase
    .from("notification_queue")
    .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function markSkipped(supabase: AdminClient, id: string) {
  // No recipients / org disabled the notification — a no-op, not a send.
  await supabase
    .from("notification_queue")
    .update({ status: "skipped", last_error: null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function recordFailure(supabase: AdminClient, row: QueueRow, message: string) {
  // claim_notification_batch already bumped attempts and pushed next_attempt_at
  // out by the lease. If we've now exhausted attempts, mark failed; otherwise
  // leave it pending so the lease expiry retries it.
  const exhausted = row.attempts >= row.max_attempts;
  await supabase
    .from("notification_queue")
    .update({
      status: exhausted ? "failed" : "pending",
      last_error: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
}

/**
 * Claim a batch of due queue rows and send them. Safe to run concurrently
 * (cron + the after() immediate attempt) — the claim uses FOR UPDATE SKIP
 * LOCKED with a lease, so two drains never grab the same row.
 */
export async function drainNotificationQueue(limit = 25): Promise<DrainResult> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("claim_notification_batch", {
    batch_limit: limit,
  });
  if (error) throw error;

  const rows = (data ?? []) as QueueRow[];
  const result: DrainResult = { claimed: rows.length, sent: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    try {
      let built = null;
      if (row.kind === "status_change" && row.enrollment_id && row.organization_id) {
        built = await renderStatusChange(supabase, {
          enrollmentId: row.enrollment_id,
          organizationId: row.organization_id,
          payload: row.payload ?? {},
        });
      } else if (row.kind === "comment" && row.enrollment_id && row.organization_id && row.comment_id) {
        built = await renderComment(supabase, {
          enrollmentId: row.enrollment_id,
          organizationId: row.organization_id,
          commentId: row.comment_id,
          payload: row.payload ?? {},
        });
      }

      if (!built) {
        await markSkipped(supabase, row.id);
        result.skipped++;
        continue;
      }

      await sendEmail(built);
      await markSent(supabase, row.id);
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordFailure(supabase, row, message);
      result.failed++;
    }
  }

  return result;
}
