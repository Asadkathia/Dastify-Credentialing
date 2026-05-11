import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function statusChangeEmail(opts: {
  clientName: string;
  providerOrGroupName: string;
  payerName: string;
  state: string;
  fromStatus: EnrollmentStatus | null;
  toStatus: EnrollmentStatus;
  enrollmentId: string;
}) {
  const subject = `Status update — ${opts.providerOrGroupName} · ${opts.payerName} (${opts.state}): ${STATUS_LABELS[opts.toStatus]}`;
  const text = `Hi ${opts.clientName} team,

The status for the following enrollment has been updated:

  Provider/Group: ${opts.providerOrGroupName}
  Payer: ${opts.payerName}
  State: ${opts.state}
  ${opts.fromStatus ? `Previous status: ${STATUS_LABELS[opts.fromStatus]}` : "Created at"}: ${STATUS_LABELS[opts.toStatus]}

View in the portal:
${APP_URL}/portal/enrollments/${opts.enrollmentId}

— Dastify Credentialing`;
  const html = text.replaceAll("\n", "<br>");
  return { subject, text, html };
}

export function commentPostedEmail(opts: {
  recipientName: string;
  authorName: string;
  bodyExcerpt: string;
  enrollmentId: string;
}) {
  const subject = `New comment from ${opts.authorName}`;
  const text = `${opts.recipientName},

${opts.authorName} posted a comment on an enrollment:

  "${opts.bodyExcerpt.length > 200 ? opts.bodyExcerpt.slice(0, 197) + "..." : opts.bodyExcerpt}"

View and reply:
${APP_URL}/admin (or /portal)

— Dastify`;
  const html = text.replaceAll("\n", "<br>");
  return { subject, text, html };
}

export function digestEmail(opts: {
  clientName: string;
  periodLabel: string;
  statusChanges: Array<{ summary: string; at: string }>;
  newComments: number;
}) {
  const subject = `${opts.clientName} — ${opts.periodLabel} credentialing digest`;
  const lines: string[] = [
    `Hi ${opts.clientName} team,`,
    "",
    `Here's your ${opts.periodLabel.toLowerCase()} credentialing summary.`,
    "",
    `• Status changes: ${opts.statusChanges.length}`,
    `• New comments: ${opts.newComments}`,
    "",
  ];
  if (opts.statusChanges.length > 0) {
    lines.push("Recent activity:");
    opts.statusChanges.slice(0, 10).forEach((c) => lines.push(`  - ${c.summary} (${c.at})`));
    lines.push("");
  }
  lines.push(`Open the portal: ${APP_URL}/portal`);
  const text = lines.join("\n");
  return { subject, text, html: text.replaceAll("\n", "<br>") };
}
