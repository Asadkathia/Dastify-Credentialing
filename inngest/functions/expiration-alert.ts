import { inngest } from "../client";

/**
 * Daily document-expiration alert. Runs 04:00 UTC.
 *
 * TODO(v1.1): for each client, find documents with expiration_date within
 * `client_settings.expiration_alert_days_before` days; send a single roll-up
 * email to admins + client_admins per client per day.
 */
export const expirationAlert = inngest.createFunction(
  { id: "expiration-alert", name: "Daily document expiration alert" },
  { cron: "0 4 * * *" },
  async () => {
    return { alerted: 0, todo: "Implement expiration query + email send" };
  },
);
