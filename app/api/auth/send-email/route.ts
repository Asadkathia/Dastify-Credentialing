import { Webhook } from "standardwebhooks";
import { sendEmail } from "@/lib/email/client";
import { buildAuthEmail, type AuthEmailData } from "@/lib/email/auth-templates";

export const runtime = "nodejs";

type HookPayload = {
  user: { email: string };
  email_data: AuthEmailData;
};

/**
 * Supabase Auth "Send Email Hook" endpoint. Supabase POSTs auth emails here
 * (invite, magic link, recovery, signup, email change, reauthentication)
 * instead of sending them itself, so they go out through the same Microsoft
 * Graph wrapper as the rest of the app. Secured by a Standard Webhooks
 * signature; the shared secret is SEND_EMAIL_HOOK_SECRET (format `v1,whsec_…`).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error("[send-email-hook] SEND_EMAIL_HOOK_SECRET is not set");
    return Response.json(
      { error: { message: "Hook secret not configured" } },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let data: HookPayload;
  try {
    const wh = new Webhook(secret.replace("v1,whsec_", ""));
    data = wh.verify(payload, headers) as HookPayload;
  } catch {
    return Response.json(
      { error: { message: "Invalid signature" } },
      { status: 401 },
    );
  }

  try {
    const built = buildAuthEmail(data.email_data);
    await sendEmail({
      to: data.user.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
  } catch (err) {
    console.error("[send-email-hook] send failed", err);
    return Response.json(
      { error: { message: "Failed to send email" } },
      { status: 500 },
    );
  }

  return Response.json({});
}
