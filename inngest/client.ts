import "server-only";
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "dastify-credentialing",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export type AppEvents = {
  "enrollment/status_changed": {
    data: {
      enrollmentId: string;
      organizationId: string;
      fromStatus: string | null;
      toStatus: string;
    };
  };
  "comment/posted": {
    data: {
      commentId: string;
      enrollmentId: string;
      organizationId: string;
      authorUserId: string;
    };
  };
  "digest/cron": { data: { frequency: "daily" | "weekly" } };
  "documents/expiration_check": Record<string, never>;
};
