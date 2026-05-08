-- =============================================================================
-- Audit FK behavior: change CASCADE → SET NULL on audit-table foreign keys.
-- =============================================================================
-- Audit trail rows (status_history, activity_events) should outlive their
-- subjects. The original CASCADE behavior would attempt to DELETE audit rows
-- when a parent client/enrollment was deleted — which the append-only trigger
-- in 0001_audit_triggers.sql correctly blocks.
--
-- Switch to SET NULL: when a parent is deleted (rare in prod — soft-delete via
-- deleted_at is the normal path), the audit row persists with a null reference.
-- The audit history remains queryable; it just becomes unattributed.
--
-- NOTE: even with SET NULL, hard-deleting a parent will hit the append-only
-- trigger (which blocks all UPDATE on audit tables). For the rare hard-delete
-- case, set `session_replication_role = replica` in your session before the
-- DELETE — this disables triggers (and FK cascades, so you must also manually
-- DELETE child rows). In production, do not hard-delete; soft-delete instead.
-- =============================================================================

ALTER TABLE status_history
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN enrollment_id DROP NOT NULL;

ALTER TABLE status_history
  DROP CONSTRAINT status_history_client_id_fkey,
  ADD CONSTRAINT status_history_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE status_history
  DROP CONSTRAINT status_history_enrollment_id_fkey,
  ADD CONSTRAINT status_history_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;

ALTER TABLE activity_events
  DROP CONSTRAINT activity_events_client_id_fkey,
  ADD CONSTRAINT activity_events_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
