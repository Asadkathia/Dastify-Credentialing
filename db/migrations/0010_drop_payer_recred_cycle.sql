-- =============================================================================
-- Drop payers.recred_cycle_months — last residue of the recred module
-- =============================================================================
-- Migration 0009 removed recred from enrollments + the compute trigger; this
-- column on the payers master table fed that trigger and now has no consumer.
-- Dropping it keeps the schema honest.
-- =============================================================================

ALTER TABLE payers DROP COLUMN IF EXISTS recred_cycle_months;
