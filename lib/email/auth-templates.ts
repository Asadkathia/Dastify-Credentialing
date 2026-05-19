const APP_NAME = "Dastify Credentialing";

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

function layout(heading: string, bodyLines: string[], cta?: { label: string; url: string }): BuiltEmail["html"] {
  const paragraphs = bodyLines.map((l) => `<p>${l}</p>`).join("");
  const button = cta
    ? `<p><a href="${cta.url}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px">${cta.label}</a></p>
       <p style="font-size:12px;color:#64748b">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>`
    : "";
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2>${heading}</h2>
    ${paragraphs}
    ${button}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8">— ${APP_NAME}</p>
  </div>`;
}

function plain(bodyLines: string[], cta?: { label: string; url: string }): string {
  const lines = [...bodyLines];
  if (cta) {
    lines.push("", `${cta.label}: ${cta.url}`);
  }
  lines.push("", `— ${APP_NAME}`);
  return lines.join("\n");
}

/**
 * Build the outbound email for a Supabase Auth Send Email Hook event.
 * Covers the action types that produce a user-facing email; unknown/notification
 * types fall through to a generic notice so we never silently drop a hook call.
 */
export function buildAuthEmail(data: AuthEmailData): BuiltEmail {
  switch (data.email_action_type) {
    case "signup": {
      const url = verifyUrl(data);
      const body = ["Confirm your email address to finish setting up your account."];
      const cta = { label: "Confirm email", url };
      return {
        subject: `${APP_NAME} — confirm your email`,
        html: layout("Confirm your email", body, cta),
        text: plain(body, cta),
      };
    }
    case "invite": {
      const url = verifyUrl(data);
      const body = [
        `You've been invited to ${APP_NAME}.`,
        "Click below to accept the invitation and set up your access.",
      ];
      const cta = { label: "Accept invitation", url };
      return {
        subject: `You've been invited to ${APP_NAME}`,
        html: layout("You're invited", body, cta),
        text: plain(body, cta),
      };
    }
    case "magiclink": {
      const url = verifyUrl(data);
      const body = ["Use the link below to sign in. It expires shortly and can only be used once."];
      const cta = { label: "Sign in", url };
      return {
        subject: `${APP_NAME} — your sign-in link`,
        html: layout("Sign in", body, cta),
        text: plain(body, cta),
      };
    }
    case "recovery": {
      const url = verifyUrl(data);
      const body = [
        "We received a request to reset your password.",
        "Click below to choose a new one. If you didn't request this, you can ignore this email.",
      ];
      const cta = { label: "Reset password", url };
      return {
        subject: `${APP_NAME} — reset your password`,
        html: layout("Reset your password", body, cta),
        text: plain(body, cta),
      };
    }
    case "email_change":
    case "email": {
      const url = verifyUrl(data);
      const body = ["Confirm this email address to complete your email change."];
      const cta = { label: "Confirm email change", url };
      return {
        subject: `${APP_NAME} — confirm your email change`,
        html: layout("Confirm email change", body, cta),
        text: plain(body, cta),
      };
    }
    case "reauthentication": {
      const body = [
        "Your verification code is:",
        `<strong style="font-size:20px;letter-spacing:2px">${data.token}</strong>`,
        "Enter it to confirm this action. If you didn't request this, ignore this email.",
      ];
      return {
        subject: `${APP_NAME} — your verification code`,
        html: layout("Verification code", body),
        text: plain([
          "Your verification code is:",
          data.token,
          "Enter it to confirm this action. If you didn't request this, ignore this email.",
        ]),
      };
    }
    default: {
      // Notification-only types (password_changed_notification, etc.) and any
      // future action types: send a neutral notice rather than drop the hook.
      const body = [
        `There was an account activity update on your ${APP_NAME} account (${data.email_action_type}).`,
        "If this wasn't you, contact your administrator.",
      ];
      return {
        subject: `${APP_NAME} — account notification`,
        html: layout("Account notification", body),
        text: plain(body),
      };
    }
  }
}
