-- =============================================================================
-- Drop `completed` status — pipeline shrinks from 5 → 4 linear stages
-- =============================================================================
-- The `completed` value introduced in 0009 is being removed. The new linear
-- happy-path terminates at `approved`. Backfill mapping:
--
--   completed → approved
--
-- Affects `enrollments.status` and `status_history.{from_status, to_status}`.
-- The status-change audit trigger is dropped before the enum swap and recreated
-- after — same pattern as 0009.
-- =============================================================================

BEGIN;

-- ── 1. Drop triggers that depend on enrollments.status ─────────────────────

DROP TRIGGER IF EXISTS trg_enrollment_status_change ON enrollments;

-- ── 2. Status enum swap ────────────────────────────────────────────────────

ALTER TABLE enrollments ALTER COLUMN status DROP DEFAULT;

ALTER TYPE enrollment_status RENAME TO enrollment_status_old;

CREATE TYPE enrollment_status AS ENUM (
  'prep',
  'submitted',
  'in_review',
  'approved',
  'non_par_credentialed'
);

-- Convert enrollments.status: enum → text → mapping → new enum.
ALTER TABLE enrollments ALTER COLUMN status TYPE text USING status::text;
UPDATE enrollments SET status = 'approved' WHERE status = 'completed';
ALTER TABLE enrollments
  ALTER COLUMN status TYPE enrollment_status USING status::enrollment_status;
ALTER TABLE enrollments ALTER COLUMN status SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN status SET DEFAULT 'prep'::enrollment_status;

-- Same for status_history. The append-only guard blocks UPDATEs, so disable it
-- for the duration of this migration.
ALTER TABLE status_history DISABLE TRIGGER trg_status_history_no_update;

ALTER TABLE status_history ALTER COLUMN from_status TYPE text USING from_status::text;
ALTER TABLE status_history ALTER COLUMN to_status TYPE text USING to_status::text;

UPDATE status_history SET from_status = 'approved' WHERE from_status = 'completed';
UPDATE status_history SET to_status   = 'approved' WHERE to_status   = 'completed';

ALTER TABLE status_history
  ALTER COLUMN from_status TYPE enrollment_status USING from_status::enrollment_status;
ALTER TABLE status_history
  ALTER COLUMN to_status TYPE enrollment_status USING to_status::enrollment_status;

ALTER TABLE status_history ENABLE TRIGGER trg_status_history_no_update;

DROP TYPE enrollment_status_old;

-- ── 3. Recreate the status-change audit trigger ────────────────────────────

CREATE TRIGGER trg_enrollment_status_change
  AFTER INSERT OR UPDATE OF status, sub_status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

COMMIT;
