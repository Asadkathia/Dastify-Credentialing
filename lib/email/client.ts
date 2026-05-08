import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  cached = new Resend(key);
  return cached;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

/**
 * The single point of email egress. All transactional email goes through here.
 * Adds the standard from-address and applies basic correlation logging.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "Dastify <noreply@example.com>";

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}
