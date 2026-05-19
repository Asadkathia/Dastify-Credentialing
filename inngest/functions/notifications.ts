import { inngest } from "../client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { statusChangeEmail, commentPostedEmail } from "@/lib/email/templates";
import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Build a display name for a clinician per CLAUDE.md rule 11.
 * "Last, First M." with optional middle initial and suffix.
 */
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

export const enrollmentStatusChangedNotification = inngest.createFunction(
  {
    id: "enrollment-status-changed-notification",
    name: "Send email on enrollment status change",
    retries: 3,
    triggers: [{ event: "enrollment/status_changed" }],
  },
  async ({ event, step }) => {
    const { enrollmentId, organizationId, fromStatus, toStatus } = event.data;

    const ctx = await step.run("resolve-context", async () => {
      const supabase = createSupabaseAdminClient();

      const [{ data: enrollment }, { data: org }, { data: settings }] =
        await Promise.all([
          supabase
            .from("enrollments")
            .select(
              "id, state, payer_id, client_id, payers(name), clients(first_name, middle_name, last_name, suffix)",
            )
            .eq("id", enrollmentId)
            .maybeSingle(),
          supabase
            .from("organizations")
            .select("id, display_name")
            .eq("id", organizationId)
            .maybeSingle(),
          supabase
            .from("organization_settings")
            .select("notify_on_status_change")
            .eq("organization_id", organizationId)
            .maybeSingle(),
        ]);

      return { enrollment, org, settings };
    });

    if (!ctx.enrollment || !ctx.org) {
      return { skipped: true, reason: "enrollment_or_org_not_found" };
    }
    if (ctx.settings && ctx.settings.notify_on_status_change === false) {
      return { skipped: true, reason: "org_disabled_status_change_notifications" };
    }

    const recipients = await step.run("resolve-recipients", async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("organization_users")
        .select("email")
        .eq("organization_id", organizationId)
        .eq("role", "org_admin")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((r) => r.email).filter(Boolean);
    });

    if (recipients.length === 0) {
      return { skipped: true, reason: "no_active_org_admins" };
    }

    const client = Array.isArray(ctx.enrollment.clients)
      ? ctx.enrollment.clients[0]
      : ctx.enrollment.clients;
    const payer = Array.isArray(ctx.enrollment.payers)
      ? ctx.enrollment.payers[0]
      : ctx.enrollment.payers;

    if (!client || !payer) {
      return { skipped: true, reason: "missing_client_or_payer" };
    }

    const tpl = statusChangeEmail({
      clientName: ctx.org.display_name,
      providerOrGroupName: clientDisplayName(client),
      payerName: payer.name,
      state: ctx.enrollment.state,
      fromStatus: (fromStatus as EnrollmentStatus | null) ?? null,
      toStatus: toStatus as EnrollmentStatus,
      enrollmentId,
    });

    await step.run("send-email", async () => {
      await sendEmail({ to: recipients, subject: tpl.subject, html: tpl.html, text: tpl.text });
    });

    return { sent: true, recipients: recipients.length };
  },
);

export const commentPostedNotification = inngest.createFunction(
  {
    id: "comment-posted-notification",
    name: "Send email on new comment",
    retries: 3,
    triggers: [{ event: "comment/posted" }],
  },
  async ({ event, step }) => {
    const { commentId, enrollmentId, organizationId, authorUserId } = event.data;

    const ctx = await step.run("resolve-context", async () => {
      const supabase = createSupabaseAdminClient();
      const [
        { data: comment },
        { data: org },
        { data: adminAuthor },
        { data: orgAuthor },
      ] = await Promise.all([
        supabase
          .from("comments")
          .select("id, body, author_user_id")
          .eq("id", commentId)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("id, display_name")
          .eq("id", organizationId)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("id, full_name, email")
          .eq("id", authorUserId)
          .maybeSingle(),
        supabase
          .from("organization_users")
          .select("id, full_name, email")
          .eq("id", authorUserId)
          .maybeSingle(),
      ]);
      return { comment, org, adminAuthor, orgAuthor };
    });

    if (!ctx.comment || !ctx.org) {
      return { skipped: true, reason: "comment_or_org_not_found" };
    }

    const authorIsAdmin = !!ctx.adminAuthor;
    const authorName =
      ctx.adminAuthor?.full_name ?? ctx.orgAuthor?.full_name ?? "Someone";

    const recipients = await step.run("resolve-recipients", async () => {
      const supabase = createSupabaseAdminClient();
      if (authorIsAdmin) {
        // Dastify admin commented → notify the org's org_admins.
        const { data, error } = await supabase
          .from("organization_users")
          .select("email")
          .eq("organization_id", organizationId)
          .eq("role", "org_admin")
          .eq("is_active", true);
        if (error) throw error;
        return (data ?? []).map((r) => r.email).filter(Boolean);
      } else {
        // Org user commented → notify all active Dastify admins.
        const { data, error } = await supabase
          .from("admin_users")
          .select("email")
          .eq("is_active", true);
        if (error) throw error;
        return (data ?? [])
          .map((r) => r.email)
          .filter((email): email is string => Boolean(email) && email !== ctx.adminAuthor?.email);
      }
    });

    if (recipients.length === 0) {
      return { skipped: true, reason: "no_recipients" };
    }

    const tpl = commentPostedEmail({
      recipientName: authorIsAdmin ? ctx.org.display_name : "Dastify team",
      authorName,
      bodyExcerpt: ctx.comment.body,
      enrollmentId,
    });

    await step.run("send-email", async () => {
      await sendEmail({ to: recipients, subject: tpl.subject, html: tpl.html, text: tpl.text });
    });

    return { sent: true, recipients: recipients.length };
  },
);
