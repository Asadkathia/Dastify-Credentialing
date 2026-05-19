import { inngest } from "../client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { digestEmail } from "@/lib/email/templates";

type Frequency = "daily" | "weekly";

const WINDOW_MS: Record<Frequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const PERIOD_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

async function runDigest(frequency: Frequency) {
  const supabase = createSupabaseAdminClient();
  const windowStart = new Date(Date.now() - WINDOW_MS[frequency]).toISOString();

  const { data: orgs, error: orgsErr } = await supabase
    .from("organization_settings")
    .select("organization_id, organizations(id, display_name, is_active, deleted_at)")
    .eq("digest_email_frequency", frequency);
  if (orgsErr) throw orgsErr;

  type OrgRow = { id: string; display_name: string; is_active: boolean; deleted_at: string | null };
  const eligibleOrgs: OrgRow[] = [];
  for (const row of orgs ?? []) {
    const org = (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) as
      | OrgRow
      | null
      | undefined;
    if (!org) continue;
    if (!org.is_active || org.deleted_at) continue;
    eligibleOrgs.push(org);
  }

  let sent = 0;
  let skipped = 0;

  for (const org of eligibleOrgs) {
    const [statusChangesRes, commentCountRes, recipientsRes] = await Promise.all([
      supabase
        .from("activity_events")
        .select("summary, occurred_at")
        .eq("organization_id", org.id)
        .eq("action", "status_change")
        .gte("occurred_at", windowStart)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("action", "comment_post")
        .gte("occurred_at", windowStart),
      supabase
        .from("organization_users")
        .select("email")
        .eq("organization_id", org.id)
        .eq("is_active", true),
    ]);

    const statusChanges = (statusChangesRes.data ?? []).map((r) => ({
      summary: r.summary ?? "(no summary)",
      at: new Date(r.occurred_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }));
    const newComments = commentCountRes.count ?? 0;
    const recipients = (recipientsRes.data ?? []).map((r) => r.email).filter(Boolean);

    if (statusChanges.length === 0 && newComments === 0) {
      skipped++;
      continue;
    }
    if (recipients.length === 0) {
      skipped++;
      continue;
    }

    const tpl = digestEmail({
      clientName: org.display_name,
      periodLabel: PERIOD_LABEL[frequency],
      statusChanges,
      newComments,
    });

    await sendEmail({
      to: recipients,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    sent++;
  }

  return { frequency, sent, skipped, eligible: eligibleOrgs.length };
}

/**
 * Weekly digest email per organization. Runs Monday 14:00 UTC.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: "digest-weekly",
    name: "Weekly organization digest",
    triggers: [{ cron: "0 14 * * 1" }],
  },
  async () => runDigest("weekly"),
);

/**
 * Daily digest email. Runs 14:00 UTC.
 */
export const dailyDigest = inngest.createFunction(
  {
    id: "digest-daily",
    name: "Daily organization digest",
    triggers: [{ cron: "0 14 * * *" }],
  },
  async () => runDigest("daily"),
);
