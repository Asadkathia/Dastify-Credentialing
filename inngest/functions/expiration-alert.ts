import { inngest } from "../client";

/**
 * Daily document-expiration alert. Runs 04:00 UTC.
 *
 * TODO(v1.1): for each organization, find documents with expiration_date within
 * `organization_settings.expiration_alert_days_before` days; send a single
 * roll-up email to admins + org_admins per organization per day.
 */
export const expirationAlert = inngest.createFunction(
  {
    id: "expiration-alert",
    name: "Daily document expiration alert",
    triggers: [{ cron: "0 4 * * *" }],
  },
  async () => {
    return { alerted: 0, todo: "Implement expiration query + email send" };
  },
);
