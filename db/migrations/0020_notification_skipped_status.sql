-- Allow a distinct 'skipped' status on notification_queue so a no-op (no
-- recipients, or org disabled the notification) is no longer conflated with an
-- actually-sent email. The drain marks such rows 'skipped' instead of 'sent'.
ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS notification_queue_status_check;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_status_check
  CHECK (status IN ('pending','sent','failed','skipped'));
