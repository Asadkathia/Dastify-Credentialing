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
      clientId: string;
      fromStatus: string | null;
      toStatus: string;
    };
  };
  "comment/posted": {
    data: {
      commentId: string;
      enrollmentId: string;
      clientId: string;
      authorUserId: string;
    };
  };
  "digest/cron": { data: { frequency: "daily" | "weekly" } };
  "recred/check": Record<string, never>;
  "documents/expiration_check": Record<string, never>;
};
