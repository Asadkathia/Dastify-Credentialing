import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS, pipelineDisplayOrder } from "@/lib/enrollment/state-machine";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type Audience = "client" | "admin";

/** Rule 25 default; an org may override via organization_settings.disclaimer_banner_text. */
export const DEFAULT_DISCLAIMER =
  "All Insurances take up to 90-120 business days for processing.";

export const COLORS = {
  navy: "#0E143C",
  teal: "#16C1C2",
  aqua: "#4ECED1",
  lightGrey: "#F6F7FB",
  grey: "#C6CCD8",
  red: "#B3261E",
  green: "#2E7D32",
  amber: "#F4A300",
  ink: "#0E143C",
  body: "#3a3f55",
  muted: "#7a8099",
  faint: "#aab0c4",
  hairline: "#eceef5",
} as const;

const FONT_STACK =
  "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escape the five HTML-significant characters for safe interpolation into markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Audience-aware deep link to the enrollment detail screen. */
export function enrollmentUrl(
  audience: Audience,
  args: { organizationId: string; enrollmentId: string },
): string {
  return audience === "admin"
    ? `${APP_URL}/admin/organizations/${args.organizationId}/enrollments/${args.enrollmentId}`
    : `${APP_URL}/portal/enrollments/${args.enrollmentId}`;
}

export function button(
  href: string,
  label: string,
  opts: { variant?: "teal" | "navy" } = {},
): string {
  const bg = opts.variant === "navy" ? COLORS.navy : COLORS.teal;
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:8px;font-family:${FONT_STACK};">${escapeHtml(label)}</a>`;
}

const PILL_STYLES: Record<EnrollmentStatus, { bg: string; fg: string; outline?: boolean }> = {
  prep: { bg: "#eceef5", fg: COLORS.muted },
  submitted: { bg: "#fdf0d8", fg: "#7a4f00" },
  in_review: { bg: "#d8f0f0", fg: "#0E7475" },
  approved: { bg: "#e3f3e6", fg: COLORS.green },
  non_par_credentialed: { bg: "#ffffff", fg: COLORS.navy, outline: true },
};

export function statusPill(status: EnrollmentStatus): string {
  const s = PILL_STYLES[status];
  const border = s.outline ? `border:1px solid ${COLORS.navy};` : "";
  return `<span style="display:inline-block;padding:3px 11px;border-radius:999px;font-size:12px;font-weight:700;background:${s.bg};color:${s.fg};${border}font-family:${FONT_STACK};">${escapeHtml(STATUS_LABELS[status])}</span>`;
}

export function infoTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 14px;color:${COLORS.muted};width:96px;font-size:13px;">${escapeHtml(label)}</td><td style="padding:9px 14px;color:${COLORS.ink};font-weight:600;font-size:13px;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${COLORS.lightGrey};border-radius:8px;">${body}</table>`;
}

/**
 * 4-stage linear pipeline (prep → submitted → in_review → approved). Only valid
 * for linear statuses; `non_par_credentialed` is off-rail (rule 17) and renders
 * as a pill instead — callers must guard.
 */
export function pipeline(current: EnrollmentStatus): string {
  const order = pipelineDisplayOrder();
  const currentIdx = order.indexOf(current);
  const nodes = order
    .map((step, i) => {
      const done = i <= currentIdx;
      const isCurrent = i === currentIdx;
      const isApprovedTerminal = step === "approved" && isCurrent;
      const fill = isApprovedTerminal ? COLORS.green : done ? COLORS.teal : COLORS.grey;
      const size = isCurrent ? 22 : 18;
      const ring = isCurrent
        ? `border:3px solid ${isApprovedTerminal ? "#b7e0bf" : COLORS.aqua};`
        : "";
      return `<td style="text-align:center;width:25%;"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${fill};${ring}margin:0 auto;"></div></td>`;
    })
    .join("");
  const labels = order
    .map((step, i) => {
      const isCurrent = i === currentIdx;
      const color = isCurrent ? COLORS.ink : COLORS.muted;
      const weight = isCurrent ? "700" : "400";
      return `<td style="text-align:center;color:${color};font-size:11px;font-weight:${weight};padding-top:7px;font-family:${FONT_STACK};">${escapeHtml(STATUS_LABELS[step])}</td>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>${nodes}</tr><tr>${labels}</tr></table>`;
}

export function quote(text: string): string {
  return `<div style="border-left:3px solid ${COLORS.teal};background:${COLORS.lightGrey};padding:10px 14px;margin:14px 0;color:${COLORS.body};font-size:13px;font-style:italic;font-family:${FONT_STACK};">&ldquo;${escapeHtml(text)}&rdquo;</div>`;
}

/**
 * Wraps a body fragment in the branded shell (navy header + teal rule + footer).
 * `bodyHtml` is trusted markup produced by template builders; all user-supplied
 * values must already be escaped by the caller / partials.
 */
export function renderLayout(opts: {
  preheader: string;
  audience: Audience;
  bodyHtml: string;
  disclaimer?: string | null;
}): string {
  const internalTag =
    opts.audience === "admin"
      ? `<span style="background:${COLORS.amber};color:#3a2a00;font-size:9px;font-weight:800;letter-spacing:1.5px;padding:2px 7px;border-radius:5px;margin-left:8px;vertical-align:middle;">INTERNAL</span>`
      : "";

  const footerInner =
    opts.audience === "admin"
      ? `Dastify Connect &middot; internal notification`
      : `${
          opts.disclaimer
            ? `<span style="display:block;color:${COLORS.muted};margin-bottom:5px;">${escapeHtml(opts.disclaimer)}</span>`
            : ""
        }Dastify Connect`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:${COLORS.lightGrey};font-family:${FONT_STACK};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLORS.lightGrey};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${COLORS.hairline};">
<tr><td style="background:${COLORS.navy};padding:18px 26px;">
<span style="color:#ffffff;font-weight:700;letter-spacing:.5px;font-size:16px;">DASTIFY</span><span style="color:${COLORS.aqua};font-size:11px;letter-spacing:2px;margin-left:8px;">CREDENTIALING</span>${internalTag}
</td></tr>
<tr><td style="height:3px;background:${COLORS.teal};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:26px;color:${COLORS.body};font-size:14px;line-height:1.5;">${opts.bodyHtml}</td></tr>
<tr><td style="background:${COLORS.lightGrey};padding:16px 26px;border-top:1px solid ${COLORS.hairline};color:${COLORS.faint};font-size:11px;line-height:1.5;">${footerInner}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
