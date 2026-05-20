import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Verifies a cron request carries `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron injects this header automatically when CRON_SECRET is set; the
 * VPS crontab sends the same header via curl. Constant-time compare.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
