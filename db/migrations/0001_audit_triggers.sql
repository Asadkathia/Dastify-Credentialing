-- =============================================================================
-- Audit triggers
-- =============================================================================
-- Automatically log:
--   1. status changes on enrollments → status_history
--   2. recred date computation when status hits 'effective'
--
-- Hand-rolled application-layer activity_events are inserted by server actions.
-- =============================================================================

-- ── Status change trigger ────────────────────────────────────────────────────
-- Inserts a status_history row whenever an enrollment is created or its
-- status / sub_status changes. The actor is read from auth.uid() (set by
-- Supabase RLS-mode connections) or from the GUC `app.actor_user_id` (set by
-- server-side service-role connections that have the user's identity in scope).
CREATE OR REPLACE FUNCTION log_enrollment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  );

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO status_history (
      client_id, enrollment_id,
      from_status, to_status,
      from_sub_status, to_sub_status,
      reason, changed_by_user_id
    ) VALUES (
      NEW.client_id, NEW.id,
      NULL, NEW.status,
      NULL, NEW.sub_status,
      'created',
      COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid)
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.sub_status IS DISTINCT FROM NEW.sub_status) THEN
      INSERT INTO status_history (
        client_id, enrollment_id,
        from_status, to_status,
        from_sub_status, to_sub_status,
        reason, changed_by_user_id
      ) VALUES (
        NEW.client_id, NEW.id,
        OLD.status, NEW.status,
        OLD.sub_status, NEW.sub_status,
        NULL,
        COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid)
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_enrollment_status_change
  AFTER INSERT OR UPDATE OF status, sub_status ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION log_enrollment_status_change();

-- ── Recred date computation ──────────────────────────────────────────────────
-- When status flips to 'effective', set effective_date (if null) and compute
-- next_recred_due_date from the payer's recred_cycle_months.
CREATE OR REPLACE FUNCTION compute_recred_due_date()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_months integer;
BEGIN
  IF (TG_OP = 'UPDATE'
      AND OLD.status IS DISTINCT FROM NEW.status
      AND NEW.status = 'effective') THEN

    IF NEW.effective_date IS NULL THEN
      NEW.effective_date := CURRENT_DATE;
    END IF;

    SELECT recred_cycle_months INTO v_cycle_months FROM payers WHERE id = NEW.payer_id;
    IF v_cycle_months IS NOT NULL AND NEW.next_recred_due_date IS NULL THEN
      NEW.next_recred_due_date := NEW.effective_date + (v_cycle_months || ' months')::interval;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollment_compute_recred_due
  BEFORE UPDATE OF status ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION compute_recred_due_date();

-- ── Append-only enforcement on audit tables ──────────────────────────────────
CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is append-only; UPDATE/DELETE on % is forbidden', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_status_history_no_update
  BEFORE UPDATE OR DELETE ON "status_history"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

CREATE TRIGGER trg_activity_events_no_update
  BEFORE UPDATE OR DELETE ON "activity_events"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
