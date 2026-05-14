-- =============================================================================
-- 0015: Add 'password_reset_requested' and 'password_reset_completed' to the
-- activity_action enum.
--
-- The forgot-password / reset-password flow writes two activity_events rows:
--   - 'password_reset_requested' when the user submits the request form (logged
--     server-side with the resolved user_id; the response to the client is
--     generic to avoid email enumeration).
--   - 'password_reset_completed'  when the user successfully sets a new
--     password from the link.
--
-- Postgres allows ADD VALUE inside a transaction on PG 12+, but the new values
-- cannot be referenced in the same transaction. This migration only alters the
-- type; first use comes from application code in a later request.
-- =============================================================================

ALTER TYPE public.activity_action ADD VALUE IF NOT EXISTS 'password_reset_requested';
ALTER TYPE public.activity_action ADD VALUE IF NOT EXISTS 'password_reset_completed';
