-- =============================================================================
-- Status taxonomy redesign + recredentialing removal
-- =============================================================================
-- Two coupled changes in one migration because they touch the same table:
--
-- 1. Replace the enrollment_status enum from 10 values to 6:
--      OLD: intake, prep, submitted, in_review, info_requested,
--           approved, denied, effective, closed, withdrawn
--      NEW: prep, submitted, in_review, approved,
--           non_par_credentialed, completed
--
--    Backfill mapping:
--      intake          → prep
--      info_requested  → in_review   (in-review absorbs the "pending" semantics)
--      denied          → non_par_credentialed
--      effective       → completed
--      closed          → completed
--      withdrawn       → completed
--      others          → unchanged
--
-- 2. Drop the recredentialing module entirely:
--      - enrollments.next_recred_due_date
--      - enrollments.parent_enrollment_id
--      - enrollments.cycle_number
--      - enrollments.denied_reason  (the new enum has no `denied` status)
--      - enrollments_recred_due_idx
--      - enrollments_cycle_positive CHECK
--      - trg_enrollment_compute_recred_due trigger + compute_recred_due_date()
--      - Unique indexes rebuilt without cycle_number in the key
--
-- The status-change audit trigger (trg_enrollment_status_change) is dropped
-- before the enum swap and recreated afterwards — the function body itself
-- doesn't reference any enum literals so it survives the type change.
-- =============================================================================

BEGIN;

-- ── 1. Drop triggers that depend on enrollments.status ─────────────────────

DROP TRIGGER IF EXISTS trg_enrollment_compute_recred_due ON enrollments;
DROP TRIGGER IF EXISTS trg_enrollment_status_change ON enrollments;
DROP FUNCTION IF EXISTS compute_recred_due_date();

-- ── 2. Status enum swap ────────────────────────────────────────────────────

ALTER TABLE enrollments ALTER COLUMN status DROP DEFAULT;

ALTER TYPE enrollment_status RENAME TO enrollment_status_old;

CREATE TYPE enrollment_status AS ENUM (
  'prep',
  'submitted',
  'in_review',
  'approved',
  'non_par_credentialed',
  'completed'
);

-- Convert enrollments.status: enum → text → mapping → new enum.
ALTER TABLE enrollments ALTER COLUMN status TYPE text USING status::text;
UPDATE enrollments SET status = CASE status
  WHEN 'intake'         THEN 'prep'
  WHEN 'info_requested' THEN 'in_review'
  WHEN 'denied'         THEN 'non_par_credentialed'
  WHEN 'effective'      THEN 'completed'
  WHEN 'closed'         THEN 'completed'
  WHEN 'withdrawn'      THEN 'completed'
  ELSE status
END;
ALTER TABLE enrollments
  ALTER COLUMN status TYPE enrollment_status USING status::enrollment_status;
ALTER TABLE enrollments ALTER COLUMN status SET NOT NULL;
ALTER TABLE enrollments ALTER COLUMN status SET DEFAULT 'prep'::enrollment_status;

-- Same for status_history (from_status nullable, to_status not).
-- The append-only audit guard (trg_status_history_no_update) blocks UPDATEs in
-- normal operation; disable it for the duration of this migration only.
ALTER TABLE status_history DISABLE TRIGGER trg_status_history_no_update;

ALTER TABLE status_history ALTER COLUMN from_status TYPE text USING from_status::text;
ALTER TABLE status_history ALTER COLUMN to_status TYPE text USING to_status::text;

UPDATE status_history SET from_status = CASE from_status
  WHEN 'intake'         THEN 'prep'
  WHEN 'info_requested' THEN 'in_review'
  WHEN 'denied'         THEN 'non_par_credentialed'
  WHEN 'effective'      THEN 'completed'
  WHEN 'closed'         THEN 'completed'
  WHEN 'withdrawn'      THEN 'completed'
  ELSE from_status
END WHERE from_status IS NOT NULL;

UPDATE status_history SET to_status = CASE to_status
  WHEN 'intake'         THEN 'prep'
  WHEN 'info_requested' THEN 'in_review'
  WHEN 'denied'         THEN 'non_par_credentialed'
  WHEN 'effective'      THEN 'completed'
  WHEN 'closed'         THEN 'completed'
  WHEN 'withdrawn'      THEN 'completed'
  ELSE to_status
END;

ALTER TABLE status_history
  ALTER COLUMN from_status TYPE enrollment_status USING from_status::enrollment_status;
ALTER TABLE status_history
  ALTER COLUMN to_status TYPE enrollment_status USING to_status::enrollment_status;

-- Re-enable the audit guard.
ALTER TABLE status_history ENABLE TRIGGER trg_status_history_no_update;

DROP TYPE enrollment_status_old;

-- ── 3. Drop recredentialing infrastructure ─────────────────────────────────

DROP INDEX IF EXISTS enrollments_recred_due_idx;
DROP INDEX IF EXISTS enrollments_unique_individual_idx;
DROP INDEX IF EXISTS enrollments_unique_group_idx;

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_cycle_positive;

ALTER TABLE enrollments DROP COLUMN IF EXISTS next_recred_due_date;
ALTER TABLE enrollments DROP COLUMN IF EXISTS parent_enrollment_id;
ALTER TABLE enrollments DROP COLUMN IF EXISTS cycle_number;
ALTER TABLE enrollments DROP COLUMN IF EXISTS denied_reason;

-- Rebuild the partial unique indexes without cycle_number.
CREATE UNIQUE INDEX enrollments_unique_individual_idx
  ON enrollments (client_id, provider_id, payer_id, state)
  WHERE provider_id IS NOT NULL;

CREATE UNIQUE INDEX enrollments_unique_group_idx
  ON enrollments (client_id, group_entity_id, payer_id, state)
  WHERE group_entity_id IS NOT NULL;

-- ── 4. Recreate the status-change audit trigger ────────────────────────────

CREATE TRIGGER trg_enrollment_status_change
  AFTER INSERT OR UPDATE OF status, sub_status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

COMMIT;
