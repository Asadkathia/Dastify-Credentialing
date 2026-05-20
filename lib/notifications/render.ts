import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { statusChangeEmail, commentPostedEmail } from "@/lib/email/templates";
import type { Audience } from "@/lib/email/layout";
import type { EnrollmentStatus } from "@/db/schema/enums";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type RenderedEmail = { to: string[]; subject: string; html: string; text: string };

// Display name for a clinician per CLAUDE.md rule 11: "Last, First M., Suffix".
function clientDisplayName(c: {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
}): string {
  const mi = c.middle_name ? ` ${c.middle_name[0]}.` : "";
  const suffix = c.suffix ? `, ${c.suffix}` : "";
  return `${c.last_name}, ${c.first_name}${mi}${suffix}`;
}

/**
 * Resolve recipients + build the status-change email. Returns null to signal
 * "nothing to send" (org disabled the notification, no recipients, or missing
 * data) — the caller should mark the queue row done without sending.
 */
export async function renderStatusChange(
  supabase: AdminClient,
  args: { enrollmentId: string; organizationId: string; payload: Record<string, unknown> },
): Promise<RenderedEmail | null> {
  const { enrollmentId, organizationId, payload } = args;

  const [{ data: enrollment }, { data: org }, { data: settings }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, state, payers(name), clients(first_name, middle_name, last_name, suffix)",
      )
      .eq("id", enrollmentId)
      .maybeSingle(),
    supabase.from("organizations").select("id, display_name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("organization_settings")
      .select("notify_on_status_change, disclaimer_banner_text")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (!enrollment || !org) return null;
  if (settings && settings.notify_on_status_change === false) return null;

  const client = Array.isArray(enrollment.clients) ? enrollment.clients[0] : enrollment.clients;
  const payer = Array.isArray(enrollment.payers) ? enrollment.payers[0] : enrollment.payers;
  if (!client || !payer) return null;

  // Status changes are made by the (single) Dastify admin; notify every active
  // user of the affected org — admins and viewers alike.
  const { data: orgUsers, error } = await supabase
    .from("organization_users")
    .select("email")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (error) throw error;
  const to = ((orgUsers ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
  if (to.length === 0) return null;

  const tpl = statusChangeEmail({
    clientName: org.display_name,
    providerOrGroupName: clientDisplayName(client),
    payerName: payer.name,
    state: enrollment.state,
    fromStatus: (payload.fromStatus as EnrollmentStatus | null) ?? null,
    toStatus: payload.toStatus as EnrollmentStatus,
    organizationId,
    enrollmentId,
    disclaimer: settings?.disclaimer_banner_text ?? null,
  });
  return { to, subject: tpl.subject, html: tpl.html, text: tpl.text };
}

/**
 * Resolve recipients + build the comment-posted email. If a Dastify admin
 * commented, notify the org's org_admins; if an org user commented, notify
 * active Dastify admins (excluding the author). Returns null when there's
 * nothing to send.
 */
export async function renderComment(
  supabase: AdminClient,
  args: {
    enrollmentId: string;
    organizationId: string;
    commentId: string;
    payload: Record<string, unknown>;
  },
): Promise<RenderedEmail | null> {
  const { enrollmentId, organizationId, commentId, payload } = args;
  const authorUserId = String(payload.authorUserId ?? "");

  const [commentRes, orgRes, enrollmentRes, settingsRes, adminAuthorRes, orgAuthorRes] =
    await Promise.all([
      supabase.from("comments").select("id, body").eq("id", commentId).maybeSingle(),
      supabase
        .from("organizations")
        .select("id, display_name")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("state, payers(name), clients(first_name, middle_name, last_name, suffix)")
        .eq("id", enrollmentId)
        .maybeSingle(),
      supabase
        .from("organization_settings")
        .select("disclaimer_banner_text")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase.from("admin_users").select("full_name, email").eq("id", authorUserId).maybeSingle(),
      supabase.from("organization_users").select("full_name").eq("id", authorUserId).maybeSingle(),
    ]);

  const comment = commentRes.data as { id: string; body: string } | null;
  const org = orgRes.data as { id: string; display_name: string } | null;
  const enrollment = enrollmentRes.data;
  const adminAuthor = adminAuthorRes.data as { full_name: string; email: string } | null;
  const orgAuthor = orgAuthorRes.data as { full_name: string } | null;

  if (!comment || !org || !enrollment) return null;

  const client = Array.isArray(enrollment.clients) ? enrollment.clients[0] : enrollment.clients;
  const payer = Array.isArray(enrollment.payers) ? enrollment.payers[0] : enrollment.payers;
  if (!client || !payer) return null;

  const authorIsAdmin = !!adminAuthor;
  // Dastify admin authored → notify the org (client audience); org user
  // authored → notify Dastify admins (internal audience).
  const audience: Audience = authorIsAdmin ? "client" : "admin";
  const authorName = adminAuthor?.full_name ?? orgAuthor?.full_name ?? "Someone";

  let to: string[];
  if (authorIsAdmin) {
    // Admin commented → notify every active user of the org.
    const { data, error } = await supabase
      .from("organization_users")
      .select("email")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if (error) throw error;
    to = ((data ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
  } else {
    // Org user commented → notify active Dastify admins.
    const { data, error } = await supabase
      .from("admin_users")
      .select("email")
      .eq("is_active", true);
    if (error) throw error;
    to = ((data ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
  }
  if (to.length === 0) return null;

  const tpl = commentPostedEmail({
    audience,
    authorName,
    orgName: org.display_name,
    bodyExcerpt: comment.body,
    providerOrGroupName: clientDisplayName(client),
    payerName: payer.name,
    state: enrollment.state,
    organizationId,
    enrollmentId,
    disclaimer: settingsRes.data?.disclaimer_banner_text ?? null,
  });
  return { to, subject: tpl.subject, html: tpl.html, text: tpl.text };
}
