import { COLORS, button, escapeHtml, renderLayout } from "./layout";

const APP_NAME = "Dastify Connect";

export type AuthEmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
  old_email?: string;
};

export type BuiltEmail = { subject: string; html: string; text: string };

function verifyUrl(data: AuthEmailData): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const params = new URLSearchParams({
    token: data.token_hash,
    type: data.email_action_type,
    redirect_to: data.redirect_to,
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

type AuthParts = {
  subject: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  code?: string;
};

/**
 * Build a branded auth email through the shared layout. Auth emails are account
 * actions (invite / sign-in / reset / verify), not credentialing-status mail, so
 * they carry no rule-25 disclaimer banner. All dynamic values are escaped.
 */
function compose(parts: AuthParts): BuiltEmail {
  const htmlParas = parts.paragraphs
    .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p)}</p>`)
    .join("");
  const codeBlock = parts.code
    ? `<p style="margin:16px 0;text-align:center;"><span style="display:inline-block;background:${COLORS.lightGrey};border-radius:8px;padding:12px 22px;font-size:24px;font-weight:800;letter-spacing:4px;color:${COLORS.ink};">${escapeHtml(parts.code)}</span></p>`
    : "";
  const ctaBlock = parts.cta
    ? `<p style="margin:20px 0 0;">${button(parts.cta.url, parts.cta.label)}</p>
<p style="margin:14px 0 0;color:${COLORS.muted};font-size:12px;">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(parts.cta.url)}</p>`
    : "";

  const bodyHtml = `
<p style="margin:0 0 12px;color:${COLORS.ink};font-size:16px;font-weight:700;">${escapeHtml(parts.heading)}</p>
${htmlParas}${codeBlock}${ctaBlock}`;

  const html = renderLayout({
    preheader: parts.paragraphs[0] ?? parts.heading,
    audience: "client",
    bodyHtml,
    disclaimer: null,
  });

  const textLines = [parts.heading, "", ...parts.paragraphs];
  if (parts.code) textLines.push("", parts.code);
  if (parts.cta) textLines.push("", `${parts.cta.label}: ${parts.cta.url}`);
  textLines.push("", `— ${APP_NAME}`);

  return { subject: parts.subject, html, text: textLines.join("\n") };
}

/**
 * Build the outbound email for a Supabase Auth Send Email Hook event.
 * Covers the action types that produce a user-facing email; unknown/notification
 * types fall through to a generic notice so we never silently drop a hook call.
 */
export function buildAuthEmail(data: AuthEmailData): BuiltEmail {
  switch (data.email_action_type) {
    case "signup":
      return compose({
        subject: `${APP_NAME} — confirm your email`,
        heading: "Confirm your email",
        paragraphs: ["Confirm your email address to finish setting up your account."],
        cta: { label: "Confirm email", url: verifyUrl(data) },
      });
    case "invite":
      return compose({
        subject: `You've been invited to ${APP_NAME}`,
        heading: "You're invited",
        paragraphs: [
          `You've been invited to ${APP_NAME}.`,
          "Click below to accept the invitation and set up your access.",
        ],
        cta: { label: "Accept invitation", url: verifyUrl(data) },
      });
    case "magiclink":
      return compose({
        subject: `${APP_NAME} — your sign-in link`,
        heading: "Sign in",
        paragraphs: ["Use the link below to sign in. It expires shortly and can only be used once."],
        cta: { label: "Sign in", url: verifyUrl(data) },
      });
    case "recovery":
      return compose({
        subject: `${APP_NAME} — reset your password`,
        heading: "Reset your password",
        paragraphs: [
          "We received a request to reset your password.",
          "Click below to choose a new one. If you didn't request this, you can ignore this email.",
        ],
        cta: { label: "Reset password", url: verifyUrl(data) },
      });
    case "email_change":
    case "email":
      return compose({
        subject: `${APP_NAME} — confirm your email change`,
        heading: "Confirm email change",
        paragraphs: ["Confirm this email address to complete your email change."],
        cta: { label: "Confirm email change", url: verifyUrl(data) },
      });
    case "reauthentication":
      return compose({
        subject: `${APP_NAME} — your verification code`,
        heading: "Verification code",
        paragraphs: [
          "Use the code below to confirm this action. If you didn't request this, you can ignore this email.",
        ],
        code: data.token,
      });
    default:
      // Notification-only types (password_changed_notification, etc.) and any
      // future action types: send a neutral notice rather than drop the hook.
      return compose({
        subject: `${APP_NAME} — account notification`,
        heading: "Account notification",
        paragraphs: [
          `There was an account activity update on your ${APP_NAME} account (${data.email_action_type}).`,
          "If this wasn't you, contact your administrator.",
        ],
      });
  }
}
