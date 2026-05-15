/**
 * Session-expiry policy. Single source of truth for both the server
 * (middleware.ts) and the client (IdleSessionGuard).
 *
 * Two independent timers enforce HIPAA's automatic-logoff expectation:
 *   - Idle: 30 minutes of no server-observed activity → sign out (reason=idle).
 *   - Absolute: 12 hours since `last_sign_in_at` → sign out (reason=absolute),
 *     regardless of activity. Bounds the blast radius of a stolen refresh token.
 *
 * Supabase silently rotates the access token, so the JWT's own `iat` is not a
 * usable measure of session age — it resets on every refresh. `last_sign_in_at`
 * on the user record only updates on explicit sign-in and is the right anchor
 * for the absolute cap. Idle is tracked via the `dast_activity` cookie because
 * Supabase exposes no "last server-observed activity" signal of its own.
 *
 * Per CLAUDE.md §10, the Supabase dashboard Auth → Sessions config (inactivity
 * timeout, time-box, refresh-token reuse interval) is the primary backstop;
 * these middleware checks are defense-in-depth and provide the UX redirect.
 */

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_WARNING_LEAD_MS = 60 * 1000;
export const ACTIVITY_COOKIE_NAME = "dast_activity";

export type SessionExpiryReason = "idle" | "absolute";

export function parseActivityCookie(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return ts;
}

export function parseLastSignInAt(raw: string | null | undefined): number | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : null;
}

export function checkSessionExpiry(args: {
  now: number;
  lastActivityAt: number | null;
  lastSignInAt: number | null;
}): SessionExpiryReason | null {
  const { now, lastActivityAt, lastSignInAt } = args;
  if (lastActivityAt !== null && now - lastActivityAt > SESSION_IDLE_TIMEOUT_MS) {
    return "idle";
  }
  if (lastSignInAt !== null && now - lastSignInAt > SESSION_ABSOLUTE_TIMEOUT_MS) {
    return "absolute";
  }
  return null;
}
