-- Migration 0018 — organization kind split + group_entities removal
--
-- Two coupled changes:
--   (A) Add `organizations.kind ∈ {group, individual}`. Individual orgs auto-own
--       exactly one clinician row in `clients`; a constraint trigger enforces it.
--       Adds `create_individual_organization(...)` to insert org+settings+client
--       atomically.
--   (B) Remove the `group_entities` concept entirely. Every enrollment subject is
--       now a clinician (clients.id). Drop the XOR check, the group partial-unique
--       index, the FK, the column, the table, and the `group_entity` value of
--       `document_owner_type`.
--
-- Live data (verified pre-migration): live_group_entities=0,
-- live_group_enrollments=0, live_orphan_enrollments=0, live_orgs=3,
-- live_enrollments=6. Safety guards below RAISE EXCEPTION if any of those drift.
--
-- This migration is idempotent against re-runs (object-existence guards) but the
-- safety guards intentionally fail loud if real group data appears.

BEGIN;

-- ── Phase A — safety checks ────────────────────────────────────────────────

DO $$
DECLARE
  v_live_groups bigint;
  v_live_group_enrollments bigint;
  v_orphan_enrollments bigint;
BEGIN
  -- group_entities may not exist on a partial re-run; treat as 0.
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'group_entities' AND relnamespace = 'public'::regnamespace) THEN
    SELECT COUNT(*) INTO v_live_groups FROM public.group_entities WHERE deleted_at IS NULL;
  ELSE
    v_live_groups := 0;
  END IF;
  IF v_live_groups > 0 THEN
    RAISE EXCEPTION '0018 refusing to drop group_entities: % live row(s) present', v_live_groups;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'enrollments' AND column_name = 'group_entity_id'
  ) THEN
    SELECT COUNT(*) INTO v_live_group_enrollments
      FROM public.enrollments
      WHERE group_entity_id IS NOT NULL AND deleted_at IS NULL;
  ELSE
    v_live_group_enrollments := 0;
  END IF;
  IF v_live_group_enrollments > 0 THEN
    RAISE EXCEPTION '0018 refusing to drop enrollments.group_entity_id: % live row(s) still reference a group entity', v_live_group_enrollments;
  END IF;

  -- After dropping group_entity_id we will make client_id NOT NULL — every
  -- non-soft-deleted enrollment must have a client_id today.
  SELECT COUNT(*) INTO v_orphan_enrollments
    FROM public.enrollments
    WHERE client_id IS NULL AND deleted_at IS NULL;
  IF v_orphan_enrollments > 0 THEN
    RAISE EXCEPTION '0018 cannot enforce enrollments.client_id NOT NULL: % live enrollment(s) have client_id IS NULL', v_orphan_enrollments;
  END IF;
END $$;

-- ── Phase B — drop group_entities surface ──────────────────────────────────

-- Drop policies first (FORCE RLS makes dropping a referenced policy harmless).
DROP POLICY IF EXISTS "group_entities_admin_delete"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_admin_insert"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_admin_update"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_select"            ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_admin_all"         ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_client_select_own" ON public.group_entities;

-- Drop the updated_at trigger (created in 0000) before dropping the table.
DROP TRIGGER IF EXISTS trg_group_entities_updated_at ON public.group_entities;

-- Group partial unique index, then the enrollments XOR check, then the FK + col.
DROP INDEX IF EXISTS public.enrollments_unique_group_idx;
DROP INDEX IF EXISTS public.enrollments_group_entity_id_idx;

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_subject_xor;

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_group_entity_id_fkey;
ALTER TABLE public.enrollments DROP COLUMN IF EXISTS group_entity_id;

DROP TABLE IF EXISTS public.group_entities;

-- client_id is now mandatory (enforced by data check above).
ALTER TABLE public.enrollments ALTER COLUMN client_id SET NOT NULL;

-- Replace the partial individual index with a partial index keyed
-- (organization_id, client_id, payer_id, state). It stays partial on
-- deleted_at IS NULL so soft-deleted rows don't block re-enrollment.
DROP INDEX IF EXISTS public.enrollments_unique_individual_idx;
CREATE UNIQUE INDEX enrollments_unique_individual_idx
  ON public.enrollments (organization_id, client_id, payer_id, state)
  WHERE deleted_at IS NULL;

-- Remove the `group_entity` value from the document_owner_type enum. Postgres
-- has no DROP VALUE, so swap the type: build a new enum, repoint the column,
-- then drop the old type. No live row references `group_entity` (verified).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_owner_type') THEN
    -- Refuse if any document is still tagged with the value we are about to drop.
    PERFORM 1 FROM public.documents WHERE owner_type::text = 'group_entity' LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION '0018 refusing to drop document_owner_type:group_entity — documents still reference it';
    END IF;

    ALTER TYPE public.document_owner_type RENAME TO document_owner_type_old;
    CREATE TYPE public.document_owner_type AS ENUM ('provider', 'enrollment', 'client');
    ALTER TABLE public.documents
      ALTER COLUMN owner_type TYPE public.document_owner_type
      USING owner_type::text::public.document_owner_type;
    DROP TYPE public.document_owner_type_old;
  END IF;
END $$;

-- ── Phase C — add organizations.kind ───────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'group';

-- Idempotent re-creation of the CHECK in case the column already existed.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_kind_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_kind_check CHECK (kind IN ('group','individual'));

-- Explicit backfill — no-op given DEFAULT, but documents the intent.
UPDATE public.organizations SET kind = 'group' WHERE kind IS NULL;

-- Trigger: when org.kind = 'individual', the org has at most one
-- non-soft-deleted clients row. Deferred-initially-immediate so a transaction
-- can briefly violate while inserting org + client, then settle.
CREATE OR REPLACE FUNCTION public.enforce_individual_org_single_client()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id uuid;
  v_kind text;
  v_count int;
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := COALESCE(NEW.id, OLD.id);
  ELSE
    RETURN NULL;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT kind INTO v_kind FROM public.organizations WHERE id = v_org_id;
  IF v_kind IS DISTINCT FROM 'individual' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.clients
    WHERE organization_id = v_org_id AND deleted_at IS NULL;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'organization % is kind=individual and may have at most one non-soft-deleted client (found %)', v_org_id, v_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_individual_org_single_client_clients ON public.clients;
CREATE CONSTRAINT TRIGGER trg_individual_org_single_client_clients
  AFTER INSERT OR UPDATE OF organization_id, deleted_at ON public.clients
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_individual_org_single_client();

DROP TRIGGER IF EXISTS trg_individual_org_single_client_orgs ON public.organizations;
CREATE CONSTRAINT TRIGGER trg_individual_org_single_client_orgs
  AFTER UPDATE OF kind ON public.organizations
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_individual_org_single_client();

-- One-shot creation helper for individual orgs. Inserts the org, settings, and
-- the single managed clinician row in one transaction. SECURITY INVOKER so RLS
-- on `organizations`, `organization_settings`, and `clients` still applies to
-- the caller. Returns the new organization id.
CREATE OR REPLACE FUNCTION public.create_individual_organization(
  p_legal_name text,
  p_display_name text,
  p_primary_contact_name text,
  p_primary_contact_email text,
  p_primary_contact_phone text,
  p_notes text,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_suffix text,
  p_npi text,
  p_primary_specialty text,
  p_secondary_specialty text,
  p_email text,
  p_phone text,
  p_caqh_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF p_legal_name IS NULL OR length(btrim(p_legal_name)) < 2 THEN
    RAISE EXCEPTION 'legal_name is required';
  END IF;
  IF p_display_name IS NULL OR length(btrim(p_display_name)) < 2 THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;
  IF p_first_name IS NULL OR length(btrim(p_first_name)) < 1 THEN
    RAISE EXCEPTION 'first_name is required';
  END IF;
  IF p_last_name IS NULL OR length(btrim(p_last_name)) < 1 THEN
    RAISE EXCEPTION 'last_name is required';
  END IF;

  INSERT INTO public.organizations (
    legal_name, display_name, primary_contact_name, primary_contact_email,
    primary_contact_phone, notes, kind
  ) VALUES (
    btrim(p_legal_name), btrim(p_display_name),
    NULLIF(btrim(coalesce(p_primary_contact_name, '')), ''),
    NULLIF(btrim(coalesce(p_primary_contact_email, '')), ''),
    NULLIF(btrim(coalesce(p_primary_contact_phone, '')), ''),
    NULLIF(btrim(coalesce(p_notes, '')), ''),
    'individual'
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_settings (organization_id) VALUES (v_org_id);

  INSERT INTO public.clients (
    organization_id, first_name, middle_name, last_name, suffix, npi,
    primary_specialty, secondary_specialty, caqh_id, email, phone
  ) VALUES (
    v_org_id, btrim(p_first_name),
    NULLIF(btrim(coalesce(p_middle_name, '')), ''),
    btrim(p_last_name),
    NULLIF(btrim(coalesce(p_suffix, '')), ''),
    NULLIF(btrim(coalesce(p_npi, '')), ''),
    NULLIF(btrim(coalesce(p_primary_specialty, '')), ''),
    NULLIF(btrim(coalesce(p_secondary_specialty, '')), ''),
    NULLIF(btrim(coalesce(p_caqh_id, '')), ''),
    NULLIF(btrim(coalesce(p_email, '')), ''),
    NULLIF(btrim(coalesce(p_phone, '')), '')
  );

  RETURN v_org_id;
END;
$$;

-- Grant execute to the same roles that today insert orgs/clients via PostgREST.
GRANT EXECUTE ON FUNCTION public.create_individual_organization(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) TO authenticated, service_role;

-- ── Phase D — verify ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_orgs_total bigint;
  v_orgs_group bigint;
  v_enroll_total bigint;
  v_enroll_null_client bigint;
BEGIN
  SELECT COUNT(*) INTO v_orgs_total FROM public.organizations WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_orgs_group FROM public.organizations WHERE deleted_at IS NULL AND kind = 'group';
  SELECT COUNT(*) INTO v_enroll_total FROM public.enrollments WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_enroll_null_client FROM public.enrollments WHERE deleted_at IS NULL AND client_id IS NULL;

  RAISE NOTICE '0018 verify: orgs=%, orgs_group=%, enrollments=%, enrollments_null_client=%',
    v_orgs_total, v_orgs_group, v_enroll_total, v_enroll_null_client;

  IF v_orgs_total <> v_orgs_group THEN
    RAISE EXCEPTION 'expected all live orgs to be kind=group after backfill (got %/% group)', v_orgs_group, v_orgs_total;
  END IF;
  IF v_enroll_null_client > 0 THEN
    RAISE EXCEPTION 'enrollments with client_id IS NULL after migration: %', v_enroll_null_client;
  END IF;
END $$;

COMMIT;
