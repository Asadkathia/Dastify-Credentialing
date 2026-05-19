import "server-only";
import { Inngest } from "inngest";

// Event schema reference — kept as documentation of the event shapes the app
// emits. Inngest v4 dropped the `EventSchemas`-based generic wiring; handlers
// receive event/step as untyped. If we want strict event typing back, re-wire
// via the v4 schema API (StandardSchemaV1 / staticSchema) — deferred.
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
  "documents/expiration_check": { data: Record<string, never> };
};

export const inngest = new Inngest({
  id: "dastify-credentialing",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
