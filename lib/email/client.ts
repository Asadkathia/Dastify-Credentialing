import "server-only";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_SKEW_MS = 60_000;

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
let inflight: Promise<string> | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function fetchAccessToken(): Promise<string> {
  const tenantId = requiredEnv("MS_GRAPH_TENANT_ID");
  const clientId = requiredEnv("MS_GRAPH_CLIENT_ID");
  const clientSecret = requiredEnv("MS_GRAPH_CLIENT_SECRET");

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return cachedToken.token;
  }
  if (!inflight) {
    inflight = fetchAccessToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  // Plaintext alternative is accepted for caller convenience but currently
  // not sent — Graph's structured Message body is single-part. If we ever
  // need true multipart/alternative for deliverability, swap to the
  // MIME-content variant of /sendMail (POST with text/plain + base64 RFC822).
  text?: string;
};

/**
 * The single point of email egress. All transactional email goes through here.
 * Sends via Microsoft Graph /users/{id}/sendMail using app-only auth.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const fromUser = requiredEnv("MAIL_FROM_USER_ID");
  const fromName = process.env.MAIL_FROM_NAME ?? "Dastify Credentialing";

  const token = await getAccessToken();
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map(
    (address) => ({ emailAddress: { address } }),
  );

  const url = `${GRAPH_BASE}/users/${encodeURIComponent(fromUser)}/sendMail`;
  const payload = {
    message: {
      subject: input.subject,
      body: { contentType: "HTML", content: input.html },
      from: { emailAddress: { name: fromName, address: fromUser } },
      toRecipients: recipients,
    },
    saveToSentItems: "false",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${text}`);
  }
}
