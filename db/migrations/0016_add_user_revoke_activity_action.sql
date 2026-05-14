-- =============================================================================
-- 0016: Add 'user_revoke' to the activity_action enum.
--
-- Admins can revoke an organization user (pending invite or accepted member)
-- from /admin/organizations/[id]. The action soft-revokes the row
-- (is_active = false) and bans the auth user; one activity_event is written
-- with action='user_revoke' so the audit trail records who revoked whom.
--
-- Postgres allows ADD VALUE inside a transaction on PG 12+, but the new value
-- cannot be referenced in the same transaction. This migration only alters
-- the type; first use comes from application code in a later request.
-- =============================================================================

ALTER TYPE public.activity_action ADD VALUE IF NOT EXISTS 'user_revoke';
