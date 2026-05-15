-- =============================================================================
-- 0017: Fix log_enrollment_status_change() to use renamed columns
--
-- Background: migration 0013 renamed two columns the trigger depends on:
--   - enrollments.client_id       → enrollments.organization_id
--   - enrollments.provider_id     → enrollments.client_id   (semantics swap!)
--   - status_history.client_id    → status_history.organization_id
--
-- The trigger body in 0001 (re-attached unchanged by 0009 and 0011) still
-- referenced the pre-0013 names. Post-0013 every INSERT/UPDATE on
-- enrollments.status would have failed with "column client_id of relation
-- status_history does not exist" — breaking the status-transition pipeline
-- and rule 19 (every status mutation writes a status_history row).
--
-- Verified at migration time: zero enrollments have changed status since
-- 2026-05-14 (the rename), so no corrupt rows exist; this patch closes the
-- window before the next transition.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_enrollment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  );

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO status_history (
      organization_id, enrollment_id,
      from_status, to_status,
      from_sub_status, to_sub_status,
      reason, changed_by_user_id
    ) VALUES (
      NEW.organization_id, NEW.id,
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
        organization_id, enrollment_id,
        from_status, to_status,
        from_sub_status, to_sub_status,
        reason, changed_by_user_id
      ) VALUES (
        NEW.organization_id, NEW.id,
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
