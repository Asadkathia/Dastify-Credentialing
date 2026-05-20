import { isAuthorizedCron } from "@/lib/cron/auth";
import { runDigest } from "@/lib/notifications/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends per-org digests. Intended to run once daily (e.g. 14:00 UTC): always
 * runs the daily digest; additionally runs the weekly digest on Mondays.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = [await runDigest("daily")];
    if (new Date().getUTCDay() === 1) {
      results.push(await runDigest("weekly"));
    }
    return Response.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/digest]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
