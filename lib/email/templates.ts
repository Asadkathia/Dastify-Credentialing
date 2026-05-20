import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS, pipelineDisplayOrder } from "@/lib/enrollment/state-machine";
import {
  APP_URL,
  COLORS,
  DEFAULT_DISCLAIMER,
  type Audience,
  button,
  enrollmentUrl,
  escapeHtml,
  infoTable,
  pipeline,
  quote,
  renderLayout,
  statusPill,
} from "./layout";

export type BuiltEmail = { subject: string; html: string; text: string };

const COMMENT_EXCERPT_MAX = 280;

function isLinear(status: EnrollmentStatus): boolean {
  return pipelineDisplayOrder().includes(status);
}

export function statusChangeEmail(opts: {
  clientName: string;
  providerOrGroupName: string;
  payerName: string;
  state: string;
  fromStatus: EnrollmentStatus | null;
  toStatus: EnrollmentStatus;
  organizationId: string;
  enrollmentId: string;
  disclaimer?: string | null;
}): BuiltEmail {
  const toLabel = STATUS_LABELS[opts.toStatus];
  const subject = `Status update — ${opts.providerOrGroupName} · ${opts.payerName} (${opts.state}): ${toLabel}`;
  const url = enrollmentUrl("client", {
    organizationId: opts.organizationId,
    enrollmentId: opts.enrollmentId,
  });

  const statusBlock = isLinear(opts.toStatus)
    ? pipeline(opts.toStatus)
    : `<p style="margin:0;font-size:14px;">${
        opts.fromStatus ? `${statusPill(opts.fromStatus)} <span style="color:${COLORS.grey};margin:0 6px;">&rarr;</span> ` : ""
      }${statusPill(opts.toStatus)}</p>`;

  const bodyHtml = `
<p style="margin:0 0 14px;color:${COLORS.ink};font-size:15px;">Hi ${escapeHtml(opts.clientName)} team,</p>
<p style="margin:0 0 18px;">An enrollment status was updated in your credentialing portal.</p>
${infoTable([
  ["Clinician", opts.providerOrGroupName],
  ["Payer", opts.payerName],
  ["State", opts.state],
])}
<p style="margin:18px 0 12px;color:${COLORS.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Status</p>
${statusBlock}
<p style="margin:24px 0 0;">${button(url, "View enrollment")}</p>`;

  const text = [
    `Hi ${opts.clientName} team,`,
    "",
    "An enrollment status was updated:",
    "",
    `  Clinician: ${opts.providerOrGroupName}`,
    `  Payer: ${opts.payerName}`,
    `  State: ${opts.state}`,
    `  ${opts.fromStatus ? `${STATUS_LABELS[opts.fromStatus]} -> ` : ""}${toLabel}`,
    "",
    `View in the portal: ${url}`,
    "",
    "— Dastify Connect",
  ].join("\n");

  const html = renderLayout({
    preheader: `${opts.providerOrGroupName} · ${opts.payerName} (${opts.state}) is now ${toLabel}`,
    audience: "client",
    bodyHtml,
    disclaimer: opts.disclaimer ?? DEFAULT_DISCLAIMER,
  });

  return { subject, html, text };
}

export function commentPostedEmail(opts: {
  audience: Audience;
  authorName: string;
  orgName: string;
  bodyExcerpt: string;
  providerOrGroupName: string;
  payerName: string;
  state: string;
  organizationId: string;
  enrollmentId: string;
  disclaimer?: string | null;
}): BuiltEmail {
  const subject = `New comment from ${opts.authorName}`;
  const url = enrollmentUrl(opts.audience, {
    organizationId: opts.organizationId,
    enrollmentId: opts.enrollmentId,
  });

  const excerpt =
    opts.bodyExcerpt.length > COMMENT_EXCERPT_MAX
      ? `${opts.bodyExcerpt.slice(0, COMMENT_EXCERPT_MAX - 3)}...`
      : opts.bodyExcerpt;

  const heading =
    opts.audience === "admin"
      ? `New comment from ${escapeHtml(opts.orgName)}`
      : "New comment on your enrollment";
  const authorContext =
    opts.audience === "admin"
      ? `${escapeHtml(opts.authorName)} (${escapeHtml(opts.orgName)})`
      : `${escapeHtml(opts.authorName)} (Dastify)`;
  const meta = `${opts.providerOrGroupName} · ${opts.payerName} (${opts.state})`;

  const bodyHtml = `
<p style="margin:0 0 12px;color:${COLORS.ink};font-size:15px;font-weight:600;">${heading}</p>
<p style="margin:0 0 4px;color:${COLORS.muted};font-size:13px;">${authorContext} commented on:</p>
<p style="margin:0;color:${COLORS.ink};font-weight:600;font-size:13px;">${escapeHtml(meta)}</p>
${quote(excerpt)}
<p style="margin:18px 0 0;">${button(url, "View & reply")}</p>`;

  const text = [
    `${heading}`,
    "",
    `${opts.audience === "admin" ? `${opts.authorName} (${opts.orgName})` : `${opts.authorName} (Dastify)`} commented on ${meta}:`,
    "",
    `  "${excerpt}"`,
    "",
    `View and reply: ${url}`,
    "",
    "— Dastify Connect",
  ].join("\n");

  const html = renderLayout({
    preheader: `${opts.authorName}: ${excerpt}`,
    audience: opts.audience,
    bodyHtml,
    disclaimer: opts.audience === "client" ? (opts.disclaimer ?? DEFAULT_DISCLAIMER) : null,
  });

  return { subject, html, text };
}

export function digestEmail(opts: {
  clientName: string;
  periodLabel: string;
  periodRange: string;
  statusChanges: Array<{ summary: string; at: string }>;
  newComments: number;
  disclaimer?: string | null;
}): BuiltEmail {
  const subject = `${opts.clientName} — ${opts.periodLabel} credentialing digest`;
  const url = `${APP_URL}/portal`;
  const periodLower = opts.periodLabel.toLowerCase();

  const tiles = `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:4px 0 18px;"><tr>
<td style="background:${COLORS.lightGrey};border-radius:10px;padding:16px;text-align:center;width:50%;">
<div style="font-size:26px;font-weight:800;color:${COLORS.teal};">${opts.statusChanges.length}</div>
<div style="font-size:12px;color:${COLORS.muted};">status changes</div></td>
<td style="background:${COLORS.lightGrey};border-radius:10px;padding:16px;text-align:center;width:50%;">
<div style="font-size:26px;font-weight:800;color:${COLORS.navy};">${opts.newComments}</div>
<div style="font-size:12px;color:${COLORS.muted};">new comments</div></td>
</tr></table>`;

  const activityRows = opts.statusChanges
    .slice(0, 10)
    .map(
      (c) =>
        `<tr style="border-top:1px solid #f0f2f8;"><td style="padding:8px 0;color:${COLORS.ink};font-size:13px;">${escapeHtml(c.summary)}</td><td style="padding:8px 0;text-align:right;color:${COLORS.faint};font-size:13px;white-space:nowrap;">${escapeHtml(c.at)}</td></tr>`,
    )
    .join("");
  const activity =
    opts.statusChanges.length > 0
      ? `<p style="margin:0 0 4px;color:${COLORS.muted};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Recent activity</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${activityRows}</table>`
      : "";

  const bodyHtml = `
<p style="margin:0 0 4px;color:${COLORS.ink};font-size:16px;font-weight:700;">Your ${escapeHtml(periodLower)} credentialing summary</p>
<p style="margin:0 0 14px;color:${COLORS.muted};font-size:13px;">${escapeHtml(opts.clientName)} · ${escapeHtml(opts.periodRange)}</p>
${tiles}
${activity}
<p style="margin:20px 0 0;">${button(url, "Open portal")}</p>`;

  const text = [
    `Hi ${opts.clientName} team,`,
    "",
    `Here's your ${periodLower} credentialing summary (${opts.periodRange}).`,
    "",
    `  Status changes: ${opts.statusChanges.length}`,
    `  New comments: ${opts.newComments}`,
    "",
    ...(opts.statusChanges.length > 0
      ? ["Recent activity:", ...opts.statusChanges.slice(0, 10).map((c) => `  - ${c.summary} (${c.at})`), ""]
      : []),
    `Open the portal: ${url}`,
  ].join("\n");

  const html = renderLayout({
    preheader: `${opts.statusChanges.length} status changes · ${opts.newComments} new comments`,
    audience: "client",
    bodyHtml,
    disclaimer: opts.disclaimer ?? DEFAULT_DISCLAIMER,
  });

  return { subject, html, text };
}
