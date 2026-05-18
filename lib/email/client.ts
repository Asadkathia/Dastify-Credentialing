import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) throw new Error("SMTP_HOST is not set");
  if (!port) throw new Error("SMTP_PORT is not set");
  if (!user) throw new Error("SMTP_USER is not set");
  if (!pass) throw new Error("SMTP_PASS is not set");

  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum <= 0) {
    throw new Error(`SMTP_PORT is not a valid port number: ${port}`);
  }

  // Office 365 over port 587 uses STARTTLS, not implicit TLS.
  // `secure: false` + `requireTLS: true` rejects the connection if STARTTLS
  // can't be negotiated, so we never fall back to plaintext auth.
  cached = nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465,
    requireTLS: portNum !== 465,
    auth: { user, pass },
  });

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
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ?? "Dastify Credentialing <noreply@example.com>";

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
