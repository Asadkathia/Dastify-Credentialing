import { describe, it } from "vitest";

/**
 * RLS isolation for `activity_events`.
 *
 * The client-visible action set is a curated subset (see migration 0013's
 * `activity_events_select` policy). The audit finding 1.9 flagged that the
 * 'import' action may need adding to that list — track that decision here
 * when the tests are filled in.
 */
describe("RLS: activity_events", () => {
  it.todo("platform admin sees events from every org");
  it.todo("org_admin sees only own-org events AND only the allow-listed actions");
  it.todo("org_admin does NOT see 'import' events (current behavior, see finding 1.9)");
  it.todo("org_admin cannot insert events directly (admin-only)");
  it.todo("the append-only trigger blocks UPDATE/DELETE even for service-role");
});
