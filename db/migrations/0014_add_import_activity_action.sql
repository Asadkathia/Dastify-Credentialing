-- =============================================================================
-- 0014: Add 'import' to the activity_action enum.
--
-- Bulk imports (xlsx upload at /admin/import) write one summary activity_event
-- per batch with action='import' so the audit log can distinguish imports
-- from one-off creates.
--
-- Postgres allows ADD VALUE inside a transaction on PG 12+, but the new value
-- cannot be referenced in the same transaction. This migration only alters
-- the type; first use comes from application code in a later request.
-- =============================================================================

ALTER TYPE public.activity_action ADD VALUE IF NOT EXISTS 'import';
