import { isAuthorizedCron } from "@/lib/cron/auth";
import { drainNotificationQueue } from "@/lib/notifications/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drains the notification_queue (status-change + comment emails). Hit on a
 * schedule by Vercel Cron now / system crontab on the VPS. Also called inline
 * via after() from the originating server action for low-latency delivery.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainNotificationQueue(50);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/notifications]", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
