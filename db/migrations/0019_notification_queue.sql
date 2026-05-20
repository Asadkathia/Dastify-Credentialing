-- =============================================================================
-- notification_queue: durable outbox for app transactional emails
-- =============================================================================
-- Replaces the Inngest notification path. Rows are enqueued by DB triggers (so
-- enqueue is atomic with the status change / comment insert and can never be
-- bypassed by an app code path), and drained by the cron worker
-- (/api/cron/notifications) plus an after() immediate attempt for low latency.
--
-- Access model: RLS enabled, NO policies → default-deny for authenticated/anon.
-- Only the service role and the table owner (the migration/worker postgres role,
-- exempt because FORCE is not set) can touch it. No user session ever reads it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  enrollment_id uuid,
  comment_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_queue_kind_check CHECK (kind IN ('status_change','comment')),
  CONSTRAINT notification_queue_status_check CHECK (status IN ('pending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS notification_queue_due_idx
  ON notification_queue (status, next_attempt_at);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: default-deny. service_role bypasses RLS; the worker
-- connects as the owner role which is exempt (FORCE not set). Authenticated and
-- anon get nothing.

-- ── Lease-based batch claim ──────────────────────────────────────────────────
-- Atomically claims up to `batch_limit` due rows: bumps attempts and pushes
-- next_attempt_at out by a 5-minute lease so a second concurrent drain (cron +
-- after()) won't grab the same rows. The worker marks each row sent/failed
-- afterward; if the worker crashes mid-send, the lease expires and the row is
-- retried. FOR UPDATE SKIP LOCKED makes concurrent drains non-blocking.
CREATE OR REPLACE FUNCTION claim_notification_batch(batch_limit integer)
RETURNS SETOF notification_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notification_queue q
  SET attempts = q.attempts + 1,
      next_attempt_at = now() + interval '5 minutes',
      updated_at = now()
  FROM (
    SELECT id FROM notification_queue
    WHERE status = 'pending' AND next_attempt_at <= now()
    ORDER BY created_at
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  ) due
  WHERE q.id = due.id
  RETURNING q.*;
$$;

REVOKE ALL ON FUNCTION claim_notification_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_notification_batch(integer) TO service_role;

-- ── Enqueue triggers ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so the INSERT runs as the owner (RLS-exempt) regardless of
-- which role fired the trigger.
CREATE OR REPLACE FUNCTION enqueue_status_change_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_queue (kind, organization_id, enrollment_id, payload)
  VALUES (
    'status_change',
    NEW.organization_id,
    NEW.id,
    jsonb_build_object('fromStatus', OLD.status, 'toStatus', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enqueue_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_queue (kind, organization_id, enrollment_id, comment_id, payload)
  VALUES (
    'comment',
    NEW.organization_id,
    NEW.enrollment_id,
    NEW.id,
    jsonb_build_object('authorUserId', NEW.author_user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_status_change ON enrollments;
CREATE TRIGGER trg_enqueue_status_change
  AFTER UPDATE OF status ON enrollments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enqueue_status_change_notification();

DROP TRIGGER IF EXISTS trg_enqueue_comment ON comments;
CREATE TRIGGER trg_enqueue_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_comment_notification();
