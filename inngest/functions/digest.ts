import { inngest } from "../client";

/**
 * Weekly digest email per organization. Runs Monday 14:00 UTC.
 *
 * TODO(v1.1): roll up status changes + new comments in the past 7 days for
 * each organization whose digest_email_frequency = 'weekly', then send via
 * lib/email/client.ts using digestEmail template.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: "digest-weekly",
    name: "Weekly organization digest",
    triggers: [{ cron: "0 14 * * 1" }],
  },
  async () => {
    return { sent: 0, todo: "Implement digest rollup + send" };
  },
);

/**
 * Daily digest email — same logic, daily organizations only.
 */
export const dailyDigest = inngest.createFunction(
  {
    id: "digest-daily",
    name: "Daily organization digest",
    triggers: [{ cron: "0 14 * * *" }],
  },
  async () => {
    return { sent: 0, todo: "Implement daily digest rollup + send" };
  },
);
