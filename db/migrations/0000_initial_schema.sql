-- =============================================================================
-- Dastify Credentialing Portal — Initial Schema
-- =============================================================================
-- Tables, enums, indexes, constraints. RLS policies are in 0002_rls_policies.sql.
-- Audit triggers are in 0001_audit_triggers.sql.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUM types
CREATE TYPE "enrollment_status" AS ENUM (
  'intake', 'prep', 'submitted', 'in_review', 'info_requested',
  'approved', 'denied', 'effective', 'closed', 'withdrawn'
);

CREATE TYPE "payer_type" AS ENUM (
  'commercial', 'medicare', 'medicaid', 'tricare', 'other'
);

CREATE TYPE "document_category" AS ENUM (
  'license', 'dea', 'cv', 'malpractice', 'caqh',
  'payer_letter', 'contract', 'denial', 'info_request',
  'internal_staging', 'other'
);

CREATE TYPE "document_owner_type" AS ENUM (
  'provider', 'enrollment', 'group_entity', 'client'
);

CREATE TYPE "admin_role" AS ENUM ('admin');

CREATE TYPE "client_user_role" AS ENUM ('client_admin', 'client_viewer');

CREATE TYPE "digest_frequency" AS ENUM ('off', 'daily', 'weekly');

CREATE TYPE "activity_action" AS ENUM (
  'create', 'update', 'delete', 'soft_delete', 'restore',
  'status_change', 'comment_post', 'internal_note_post',
  'document_upload', 'document_delete',
  'user_invite', 'user_login', 'export'
);

-- =============================================================================
-- Clients
-- =============================================================================
CREATE TABLE "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "legal_name" text NOT NULL,
  "display_name" text NOT NULL,
  "primary_contact_name" text,
  "primary_contact_email" text,
  "primary_contact_phone" text,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE TABLE "client_settings" (
  "client_id" uuid PRIMARY KEY REFERENCES "clients"("id") ON DELETE CASCADE,
  "disclaimer_banner_text" text NOT NULL DEFAULT 'All Insurances take up to 90-120 business days for processing.',
  "digest_email_frequency" digest_frequency NOT NULL DEFAULT 'weekly',
  "notify_on_status_change" boolean NOT NULL DEFAULT true,
  "notify_on_document_expiration" boolean NOT NULL DEFAULT true,
  "expiration_alert_days_before" integer NOT NULL DEFAULT 60,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Auth-linked tables (mirror Supabase auth.users with portal-specific data)
-- =============================================================================
CREATE TABLE "admin_users" (
  "id" uuid PRIMARY KEY REFERENCES auth.users("id") ON DELETE CASCADE,
  "email" text NOT NULL UNIQUE,
  "full_name" text NOT NULL,
  "role" admin_role NOT NULL DEFAULT 'admin',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "client_users" (
  "id" uuid PRIMARY KEY REFERENCES auth.users("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "full_name" text NOT NULL,
  "role" client_user_role NOT NULL DEFAULT 'client_viewer',
  "is_active" boolean NOT NULL DEFAULT true,
  "invited_by_user_id" uuid,
  "invited_at" timestamptz NOT NULL DEFAULT now(),
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "client_users_client_id_idx" ON "client_users" ("client_id");

-- =============================================================================
-- Providers + Group entities
-- =============================================================================
CREATE TABLE "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "first_name" text NOT NULL,
  "middle_name" text,
  "last_name" text NOT NULL,
  "suffix" text,
  "npi" text,
  "primary_specialty" text,
  "secondary_specialty" text,
  "caqh_id" text,
  "email" text,
  "phone" text,
  "license_states" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "dea_number_encrypted" bytea,
  "ssn_last4_encrypted" bytea,
  "dob_encrypted" bytea,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "providers_client_id_idx" ON "providers" ("client_id");
CREATE INDEX "providers_name_idx" ON "providers" ("last_name", "first_name");

CREATE TABLE "group_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "legal_name" text NOT NULL,
  "dba_name" text,
  "group_npi" text,
  "taxonomy_code" text,
  "tax_id_encrypted" bytea,
  "addresses" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "group_entities_client_id_idx" ON "group_entities" ("client_id");

-- =============================================================================
-- Payers (master list, global)
-- =============================================================================
CREATE TABLE "payers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "payer_type" payer_type NOT NULL DEFAULT 'commercial',
  "states_active" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "recred_cycle_months" integer NOT NULL DEFAULT 24,
  "website_url" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "payers_name_idx" ON "payers" ("name");

-- =============================================================================
-- Enrollments — the core "claim" entity
-- =============================================================================
CREATE TABLE "enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "provider_id" uuid REFERENCES "providers"("id") ON DELETE CASCADE,
  "group_entity_id" uuid REFERENCES "group_entities"("id") ON DELETE CASCADE,
  "payer_id" uuid NOT NULL REFERENCES "payers"("id") ON DELETE RESTRICT,
  "state" text NOT NULL,
  "cycle_number" integer NOT NULL DEFAULT 1,
  "parent_enrollment_id" uuid REFERENCES "enrollments"("id") ON DELETE SET NULL,
  "status" enrollment_status NOT NULL DEFAULT 'intake',
  "sub_status" text,
  "submitted_at" timestamptz,
  "effective_date" date,
  "next_recred_due_date" date,
  "denied_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "enrollments_subject_xor"
    CHECK ((provider_id IS NULL) <> (group_entity_id IS NULL)),
  CONSTRAINT "enrollments_state_format"
    CHECK ("state" ~ '^[A-Z]{2}$'),
  CONSTRAINT "enrollments_cycle_positive"
    CHECK ("cycle_number" >= 1)
);

CREATE INDEX "enrollments_client_id_idx" ON "enrollments" ("client_id");
CREATE INDEX "enrollments_provider_id_idx" ON "enrollments" ("provider_id");
CREATE INDEX "enrollments_group_entity_id_idx" ON "enrollments" ("group_entity_id");
CREATE INDEX "enrollments_payer_id_idx" ON "enrollments" ("payer_id");
CREATE INDEX "enrollments_status_idx" ON "enrollments" ("client_id", "status");
CREATE INDEX "enrollments_recred_due_idx" ON "enrollments" ("next_recred_due_date");

CREATE UNIQUE INDEX "enrollments_unique_individual_idx"
  ON "enrollments" ("client_id", "provider_id", "payer_id", "state", "cycle_number")
  WHERE "provider_id" IS NOT NULL;

CREATE UNIQUE INDEX "enrollments_unique_group_idx"
  ON "enrollments" ("client_id", "group_entity_id", "payer_id", "state", "cycle_number")
  WHERE "group_entity_id" IS NOT NULL;

-- =============================================================================
-- Comments + Internal notes
-- =============================================================================
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "parent_comment_id" uuid REFERENCES "comments"("id") ON DELETE SET NULL,
  "author_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "comments_client_id_idx" ON "comments" ("client_id");
CREATE INDEX "comments_enrollment_id_idx" ON "comments" ("enrollment_id");

CREATE TABLE "internal_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "parent_note_id" uuid REFERENCES "internal_notes"("id") ON DELETE SET NULL,
  "author_user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "internal_notes_client_id_idx" ON "internal_notes" ("client_id");
CREATE INDEX "internal_notes_enrollment_id_idx" ON "internal_notes" ("enrollment_id");

-- =============================================================================
-- Documents (polymorphic)
-- =============================================================================
CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "owner_type" document_owner_type NOT NULL,
  "owner_id" uuid NOT NULL,
  "category" document_category NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "expiration_date" date,
  "is_internal" boolean NOT NULL DEFAULT false,
  "virus_scan_status" text NOT NULL DEFAULT 'pending',
  "virus_scan_completed_at" timestamptz,
  "uploaded_by_user_id" uuid NOT NULL,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "documents_client_id_idx" ON "documents" ("client_id");
CREATE INDEX "documents_owner_idx" ON "documents" ("owner_type", "owner_id");
CREATE INDEX "documents_expiration_idx" ON "documents" ("expiration_date");

-- =============================================================================
-- Audit log — append-only
-- =============================================================================
CREATE TABLE "status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
  "from_status" enrollment_status,
  "to_status" enrollment_status NOT NULL,
  "from_sub_status" text,
  "to_sub_status" text,
  "reason" text,
  "changed_by_user_id" uuid NOT NULL,
  "changed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "status_history_enrollment_id_idx"
  ON "status_history" ("enrollment_id", "changed_at");
CREATE INDEX "status_history_client_id_idx"
  ON "status_history" ("client_id", "changed_at");

CREATE TABLE "activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE,
  "actor_user_id" uuid,
  "action" activity_action NOT NULL,
  "target_table" text NOT NULL,
  "target_id" uuid,
  "summary" text,
  "diff" jsonb,
  "metadata" jsonb,
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "activity_events_client_id_idx" ON "activity_events" ("client_id", "occurred_at");
CREATE INDEX "activity_events_target_idx" ON "activity_events" ("target_table", "target_id");
CREATE INDEX "activity_events_actor_idx" ON "activity_events" ("actor_user_id", "occurred_at");

-- =============================================================================
-- updated_at maintenance trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON "clients"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_client_settings_updated_at
  BEFORE UPDATE ON "client_settings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON "admin_users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_client_users_updated_at
  BEFORE UPDATE ON "client_users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON "providers"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_group_entities_updated_at
  BEFORE UPDATE ON "group_entities"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payers_updated_at
  BEFORE UPDATE ON "payers"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON "comments"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_internal_notes_updated_at
  BEFORE UPDATE ON "internal_notes"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
