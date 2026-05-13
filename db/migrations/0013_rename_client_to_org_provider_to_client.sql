-- =============================================================================
-- 0013: Rename tenant entities for clarity
--
--   OLD NAME       →  NEW NAME             MEANING
--   clients        →  organizations        the tenant (practice / customer org)
--   providers      →  clients              the individual clinician (a person)
--   client_users   →  organization_users   portal users belonging to an org
--   client_settings → organization_settings per-org config
--
--   client_id   column → organization_id
--   provider_id column → client_id
--   role 'client_admin' → 'org_admin'
--   role 'client_viewer' → 'org_viewer'
--   JWT claim   client_id → organization_id
--
-- group_entities keeps its name; its FK client_id becomes organization_id.
--
-- This migration is ATOMIC — everything happens inside one transaction.
-- Postgres ALTER ... RENAME operations are metadata-only and near-instant.
--
-- PRE-FLIGHT ROW COUNTS captured 2026-05-14 (asserted post-rename below):
--   organizations         = 2   (was clients)
--   clients               = 1   (was providers)
--   organization_users    = 3   (was client_users)
--   organization_settings = 2   (was client_settings)
--   enrollments           = 6
--   group_entities        = 0
--   comments              = 0
--   internal_notes        = 0
--   documents             = 0
--   status_history        = 12
--   activity_events       = 18
--   payers                = 23
--   admin_users           = 1
--
-- POST-DEPLOY MANUAL STEPS (Supabase dashboard, after this migration runs):
--   1. Auth → Hooks → re-select `public.custom_access_token_hook`
--      (the function is replaced in-place but the dashboard reference must be
--       confirmed).
--   2. Auth → Users → "Sign out all users" to force every session to refresh
--      with the new JWT claim shape. Until users re-log-in, the middleware's
--      fallback path will probe the organization_users table directly.
-- =============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Drop every RLS policy that references old column / table / helper names.
--    We recreate them all at the bottom of the transaction.
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "activity_events_admin_insert"     ON public.activity_events;
DROP POLICY IF EXISTS "activity_events_select"           ON public.activity_events;
DROP POLICY IF EXISTS "admin_users_admin_delete"         ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_admin_insert"         ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_admin_update"         ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select"               ON public.admin_users;
DROP POLICY IF EXISTS "client_settings_admin_delete"     ON public.client_settings;
DROP POLICY IF EXISTS "client_settings_admin_insert"     ON public.client_settings;
DROP POLICY IF EXISTS "client_settings_admin_update"     ON public.client_settings;
DROP POLICY IF EXISTS "client_settings_select"           ON public.client_settings;
DROP POLICY IF EXISTS "client_users_delete"              ON public.client_users;
DROP POLICY IF EXISTS "client_users_insert"              ON public.client_users;
DROP POLICY IF EXISTS "client_users_select"              ON public.client_users;
DROP POLICY IF EXISTS "client_users_update"              ON public.client_users;
DROP POLICY IF EXISTS "client_users_auth_admin_read"     ON public.client_users;
DROP POLICY IF EXISTS "clients_admin_delete"             ON public.clients;
DROP POLICY IF EXISTS "clients_admin_insert"             ON public.clients;
DROP POLICY IF EXISTS "clients_admin_update"             ON public.clients;
DROP POLICY IF EXISTS "clients_select"                   ON public.clients;
DROP POLICY IF EXISTS "comments_admin_delete"            ON public.comments;
DROP POLICY IF EXISTS "comments_insert"                  ON public.comments;
DROP POLICY IF EXISTS "comments_select"                  ON public.comments;
DROP POLICY IF EXISTS "comments_update"                  ON public.comments;
DROP POLICY IF EXISTS "document_categories_admin_delete" ON public.document_categories;
DROP POLICY IF EXISTS "document_categories_admin_insert" ON public.document_categories;
DROP POLICY IF EXISTS "document_categories_admin_update" ON public.document_categories;
DROP POLICY IF EXISTS "document_categories_select"       ON public.document_categories;
DROP POLICY IF EXISTS "documents_admin_delete"           ON public.documents;
DROP POLICY IF EXISTS "documents_admin_insert"           ON public.documents;
DROP POLICY IF EXISTS "documents_admin_update"           ON public.documents;
DROP POLICY IF EXISTS "documents_select"                 ON public.documents;
DROP POLICY IF EXISTS "enrollments_admin_delete"         ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_admin_insert"         ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_admin_update"         ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select"               ON public.enrollments;
DROP POLICY IF EXISTS "group_entities_admin_delete"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_admin_insert"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_admin_update"      ON public.group_entities;
DROP POLICY IF EXISTS "group_entities_select"            ON public.group_entities;
DROP POLICY IF EXISTS "internal_notes_admin_delete"      ON public.internal_notes;
DROP POLICY IF EXISTS "internal_notes_admin_insert"      ON public.internal_notes;
DROP POLICY IF EXISTS "internal_notes_admin_select"      ON public.internal_notes;
DROP POLICY IF EXISTS "internal_notes_admin_update"      ON public.internal_notes;
DROP POLICY IF EXISTS "payers_admin_delete"              ON public.payers;
DROP POLICY IF EXISTS "payers_admin_insert"              ON public.payers;
DROP POLICY IF EXISTS "payers_admin_update"              ON public.payers;
DROP POLICY IF EXISTS "payers_select"                    ON public.payers;
DROP POLICY IF EXISTS "providers_admin_delete"           ON public.providers;
DROP POLICY IF EXISTS "providers_admin_insert"           ON public.providers;
DROP POLICY IF EXISTS "providers_admin_update"           ON public.providers;
DROP POLICY IF EXISTS "providers_select"                 ON public.providers;
DROP POLICY IF EXISTS "status_history_admin_insert"      ON public.status_history;
DROP POLICY IF EXISTS "status_history_select"            ON public.status_history;

-- Storage bucket policies (from migration 0007) — both reference helpers
-- and/or the renamed column. Drop now; recreate at the bottom.
DROP POLICY IF EXISTS "documents_storage_admin_all"      ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_client_select"  ON storage.objects;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Drop old private-schema helper functions whose names embed old terms.
--    `private.is_admin()` keeps its name (admin terminology is unchanged).
-- ──────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS private.current_client_id();
DROP FUNCTION IF EXISTS private.is_client_admin();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Rename the role enum + its values.
--    ALTER TYPE RENAME VALUE updates all rows + defaults transparently.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.client_user_role RENAME VALUE 'client_admin'  TO 'org_admin';
ALTER TYPE public.client_user_role RENAME VALUE 'client_viewer' TO 'org_viewer';
ALTER TYPE public.client_user_role RENAME TO organization_user_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Rename tables.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients          RENAME TO organizations;
ALTER TABLE public.client_settings  RENAME TO organization_settings;
ALTER TABLE public.client_users     RENAME TO organization_users;
ALTER TABLE public.providers        RENAME TO clients;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Rename columns.
--    Order matters in enrollments: rename client_id → organization_id first,
--    THEN rename provider_id → client_id, so the names don't collide mid-rename.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organization_settings RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.organization_users    RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.clients               RENAME COLUMN client_id TO organization_id; -- on renamed providers
ALTER TABLE public.group_entities        RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.enrollments           RENAME COLUMN client_id   TO organization_id;
ALTER TABLE public.enrollments           RENAME COLUMN provider_id TO client_id;
ALTER TABLE public.comments              RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.internal_notes        RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.documents             RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.status_history        RENAME COLUMN client_id TO organization_id;
ALTER TABLE public.activity_events       RENAME COLUMN client_id TO organization_id;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Rename PK indexes/constraints to match new table names.
--    Order: rename `clients_pkey` (on what is now `organizations`) FIRST so the
--    name is free, then rename `providers_pkey` (on what is now `clients`).
-- ──────────────────────────────────────────────────────────────────────────────

ALTER INDEX public.clients_pkey          RENAME TO organizations_pkey;
ALTER INDEX public.client_settings_pkey  RENAME TO organization_settings_pkey;
ALTER INDEX public.client_users_pkey     RENAME TO organization_users_pkey;
ALTER INDEX public.providers_pkey        RENAME TO clients_pkey;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Rename non-PK indexes.
--    For enrollments: rename `enrollments_client_id_idx` to its new org name
--    FIRST so the name `enrollments_client_id_idx` is free for what was
--    `enrollments_provider_id_idx`.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER INDEX public.activity_events_client_id_idx RENAME TO activity_events_organization_id_idx;
ALTER INDEX public.client_users_client_id_idx    RENAME TO organization_users_organization_id_idx;
ALTER INDEX public.comments_client_id_idx        RENAME TO comments_organization_id_idx;
ALTER INDEX public.documents_client_id_idx       RENAME TO documents_organization_id_idx;
ALTER INDEX public.enrollments_client_id_idx     RENAME TO enrollments_organization_id_idx;
ALTER INDEX public.enrollments_provider_id_idx   RENAME TO enrollments_client_id_idx;
ALTER INDEX public.group_entities_client_id_idx  RENAME TO group_entities_organization_id_idx;
ALTER INDEX public.internal_notes_client_id_idx  RENAME TO internal_notes_organization_id_idx;
ALTER INDEX public.providers_client_id_idx       RENAME TO clients_organization_id_idx;
ALTER INDEX public.providers_name_idx            RENAME TO clients_name_idx;
ALTER INDEX public.status_history_client_id_idx  RENAME TO status_history_organization_id_idx;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Rename FK constraints (cosmetic, but the names appear in error messages).
--    Order matters for the `clients_organization_id_fkey` name: rename the OLD
--    `clients_*` constraint OFF first (there isn't one — clients (orgs) had no
--    FK to anything tenant-scoped, only PK). So no collisions.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.activity_events       RENAME CONSTRAINT activity_events_client_id_fkey       TO activity_events_organization_id_fkey;
ALTER TABLE public.organization_settings RENAME CONSTRAINT client_settings_client_id_fkey       TO organization_settings_organization_id_fkey;
ALTER TABLE public.organization_users    RENAME CONSTRAINT client_users_client_id_fkey          TO organization_users_organization_id_fkey;
ALTER TABLE public.organization_users    RENAME CONSTRAINT client_users_id_fkey                 TO organization_users_id_fkey;
ALTER TABLE public.comments              RENAME CONSTRAINT comments_client_id_fkey              TO comments_organization_id_fkey;
ALTER TABLE public.documents             RENAME CONSTRAINT documents_client_id_fkey             TO documents_organization_id_fkey;
ALTER TABLE public.enrollments           RENAME CONSTRAINT enrollments_client_id_fkey           TO enrollments_organization_id_fkey;
ALTER TABLE public.enrollments           RENAME CONSTRAINT enrollments_provider_id_fkey         TO enrollments_client_id_fkey;
ALTER TABLE public.group_entities        RENAME CONSTRAINT group_entities_client_id_fkey        TO group_entities_organization_id_fkey;
ALTER TABLE public.internal_notes        RENAME CONSTRAINT internal_notes_client_id_fkey        TO internal_notes_organization_id_fkey;
ALTER TABLE public.clients               RENAME CONSTRAINT providers_client_id_fkey             TO clients_organization_id_fkey;
ALTER TABLE public.status_history        RENAME CONSTRAINT status_history_client_id_fkey        TO status_history_organization_id_fkey;

-- The CHECK constraint on enrollments references columns — the rename above
-- already updates its expression. The constraint NAME stays `enrollments_subject_xor`.

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Rename triggers (cosmetic). Order matters for trg_clients_updated_at —
--    rename the OLD one (now on organizations) before renaming the providers
--    trigger to take its name.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TRIGGER trg_clients_updated_at         ON public.organizations         RENAME TO trg_organizations_updated_at;
ALTER TRIGGER trg_client_settings_updated_at ON public.organization_settings RENAME TO trg_organization_settings_updated_at;
ALTER TRIGGER trg_client_users_updated_at    ON public.organization_users    RENAME TO trg_organization_users_updated_at;
ALTER TRIGGER trg_providers_updated_at       ON public.clients               RENAME TO trg_clients_updated_at;

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. Recreate private-schema helper functions with new names.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
    FROM public.organization_users
   WHERE id = auth.uid() AND is_active = true
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_users
    WHERE id = auth.uid() AND is_active = true AND role = 'org_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION private.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_admin()            TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. Replace the Custom Access Token hook. Same function name (so the
--     Supabase Auth → Hooks dashboard pointer remains valid), new claim shape.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  claims jsonb;
  app_metadata jsonb;
  admin_active boolean;
  org_row record;
BEGIN
  user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';
  app_metadata := COALESCE(claims -> 'app_metadata', '{}'::jsonb);

  -- Strip any prior stamps (including old `client_id` claim from pre-rename
  -- sessions) so role changes / table moves don't leave stale claims behind.
  app_metadata := app_metadata - 'app_role' - 'client_id' - 'organization_id';

  SELECT is_active
    INTO admin_active
    FROM public.admin_users
   WHERE id = user_id;

  IF admin_active IS TRUE THEN
    app_metadata := app_metadata || jsonb_build_object('app_role', 'admin');
  ELSE
    SELECT role::text AS role, organization_id, is_active
      INTO org_row
      FROM public.organization_users
     WHERE id = user_id;

    IF org_row.is_active IS TRUE THEN
      app_metadata := app_metadata
        || jsonb_build_object(
             'app_role', org_row.role,
             'organization_id', org_row.organization_id
           );
    END IF;
  END IF;

  claims := jsonb_set(claims, '{app_metadata}', app_metadata);
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Only the Auth service should ever invoke the hook.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- The hook reads admin_users + organization_users while running as the auth
-- admin role. Re-grant SELECT on the renamed table (the prior grant on
-- client_users carried over via OID, but we make it explicit for clarity).
GRANT SELECT ON public.admin_users         TO supabase_auth_admin;
GRANT SELECT ON public.organization_users  TO supabase_auth_admin;

-- Auth-admin bypass policy on the renamed table (replaces the old
-- "client_users_auth_admin_read" policy dropped above).
CREATE POLICY "organization_users_auth_admin_read" ON public.organization_users
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- Re-create the admin_users bypass policy in case it was dropped too.
DROP POLICY IF EXISTS "admin_users_auth_admin_read" ON public.admin_users;
CREATE POLICY "admin_users_auth_admin_read" ON public.admin_users
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. Recreate RLS policies with new column / table / helper names.
--     Semantics are preserved exactly; this is purely a rename.
-- ──────────────────────────────────────────────────────────────────────────────

-- organizations (was clients)
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (private.is_admin() OR id = private.current_organization_id());
CREATE POLICY "organizations_admin_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "organizations_admin_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "organizations_admin_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- organization_settings (was client_settings)
CREATE POLICY "organization_settings_select" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "organization_settings_admin_insert" ON public.organization_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "organization_settings_admin_update" ON public.organization_settings
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "organization_settings_admin_delete" ON public.organization_settings
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- admin_users (unchanged terminology)
CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT TO authenticated
  USING (private.is_admin() OR id = (SELECT auth.uid()));
CREATE POLICY "admin_users_admin_insert" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "admin_users_admin_update" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "admin_users_admin_delete" ON public.admin_users
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- organization_users (was client_users)
CREATE POLICY "organization_users_select" ON public.organization_users
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR organization_id = private.current_organization_id()
    OR id = (SELECT auth.uid())
  );
CREATE POLICY "organization_users_insert" ON public.organization_users
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (private.is_org_admin() AND organization_id = private.current_organization_id())
  );
CREATE POLICY "organization_users_update" ON public.organization_users
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_org_admin() AND organization_id = private.current_organization_id())
  )
  WITH CHECK (
    private.is_admin()
    OR (private.is_org_admin() AND organization_id = private.current_organization_id())
  );
CREATE POLICY "organization_users_delete" ON public.organization_users
  FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_org_admin() AND organization_id = private.current_organization_id())
  );

-- clients (was providers)
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "clients_admin_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "clients_admin_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "clients_admin_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- group_entities (table name unchanged; column renamed)
CREATE POLICY "group_entities_select" ON public.group_entities
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "group_entities_admin_insert" ON public.group_entities
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "group_entities_admin_update" ON public.group_entities
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "group_entities_admin_delete" ON public.group_entities
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- payers (global master list — unchanged semantics)
CREATE POLICY "payers_select" ON public.payers
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "payers_admin_insert" ON public.payers
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "payers_admin_update" ON public.payers
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "payers_admin_delete" ON public.payers
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- enrollments
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "enrollments_admin_insert" ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "enrollments_admin_update" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "enrollments_admin_delete" ON public.enrollments
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- comments (org users can read + write their own org's enrollments)
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (
      organization_id = private.current_organization_id()
      AND author_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (
      organization_id = private.current_organization_id()
      AND author_user_id = (SELECT auth.uid())
      AND deleted_at IS NULL
      AND created_at > now() - interval '15 minutes'
    )
  )
  WITH CHECK (
    private.is_admin()
    OR (
      organization_id = private.current_organization_id()
      AND author_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "comments_admin_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- internal_notes (ADMIN ONLY — no org-user surface, ever)
CREATE POLICY "internal_notes_admin_select" ON public.internal_notes
  FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "internal_notes_admin_insert" ON public.internal_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "internal_notes_admin_update" ON public.internal_notes
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "internal_notes_admin_delete" ON public.internal_notes
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- documents
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR (
      organization_id = private.current_organization_id()
      AND is_internal = false
      AND deleted_at IS NULL
    )
  );
CREATE POLICY "documents_admin_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "documents_admin_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "documents_admin_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- document_categories (global; admin writes; everyone reads)
CREATE POLICY "document_categories_select" ON public.document_categories
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "document_categories_admin_insert" ON public.document_categories
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "document_categories_admin_update" ON public.document_categories
  FOR UPDATE TO authenticated
  USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "document_categories_admin_delete" ON public.document_categories
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- status_history (UPDATE/DELETE physically blocked by trigger)
CREATE POLICY "status_history_select" ON public.status_history
  FOR SELECT TO authenticated
  USING (private.is_admin() OR organization_id = private.current_organization_id());
CREATE POLICY "status_history_admin_insert" ON public.status_history
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

-- activity_events
CREATE POLICY "activity_events_select" ON public.activity_events
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR (
      organization_id = private.current_organization_id()
      AND action IN (
        'create', 'update',
        'status_change', 'comment_post',
        'document_upload', 'export'
      )
    )
  );
CREATE POLICY "activity_events_admin_insert" ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

-- Storage bucket policies (renamed helpers + column).
CREATE POLICY "documents_storage_admin_all"
  ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND private.is_admin())
  WITH CHECK (bucket_id = 'documents' AND private.is_admin());

CREATE POLICY "documents_storage_client_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND d.organization_id = private.current_organization_id()
        AND d.is_internal = false
        AND d.deleted_at IS NULL
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 13. Verification asserts. If anything is off, RAISE EXCEPTION → rollback.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rls_off_count int;
  expected_tables text[] := ARRAY[
    'organizations', 'organization_settings', 'organization_users',
    'clients', 'group_entities', 'enrollments', 'comments', 'internal_notes',
    'documents', 'status_history', 'activity_events'
  ];
  missing_count int;
BEGIN
  -- Every renamed/tenant-scoped table must exist.
  SELECT COUNT(*) INTO missing_count
  FROM unnest(expected_tables) AS t(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t.name AND c.relkind = 'r'
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Rename verification: % expected tables missing', missing_count;
  END IF;

  -- Old table names must NOT exist any more.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('client_settings', 'client_users', 'providers')
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Rename verification: old table name still present';
  END IF;

  -- RLS must remain enabled on every renamed table.
  SELECT COUNT(*) INTO rls_off_count
  FROM unnest(expected_tables) AS t(name)
  JOIN pg_class c ON c.relname = t.name
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relrowsecurity = false;
  IF rls_off_count > 0 THEN
    RAISE EXCEPTION 'Rename verification: RLS disabled on % renamed table(s)', rls_off_count;
  END IF;

  -- Row counts must match pre-flight snapshot.
  IF (SELECT COUNT(*) FROM public.organizations)         <> 2  THEN RAISE EXCEPTION 'organizations rowcount drift';         END IF;
  IF (SELECT COUNT(*) FROM public.clients)               <> 1  THEN RAISE EXCEPTION 'clients rowcount drift';               END IF;
  IF (SELECT COUNT(*) FROM public.organization_users)    <> 3  THEN RAISE EXCEPTION 'organization_users rowcount drift';    END IF;
  IF (SELECT COUNT(*) FROM public.organization_settings) <> 2  THEN RAISE EXCEPTION 'organization_settings rowcount drift'; END IF;
  IF (SELECT COUNT(*) FROM public.enrollments)           <> 6  THEN RAISE EXCEPTION 'enrollments rowcount drift';           END IF;
  IF (SELECT COUNT(*) FROM public.status_history)        <> 12 THEN RAISE EXCEPTION 'status_history rowcount drift';        END IF;
  IF (SELECT COUNT(*) FROM public.activity_events)       <> 18 THEN RAISE EXCEPTION 'activity_events rowcount drift';       END IF;
  IF (SELECT COUNT(*) FROM public.payers)                <> 23 THEN RAISE EXCEPTION 'payers rowcount drift';                END IF;
  IF (SELECT COUNT(*) FROM public.admin_users)           <> 1  THEN RAISE EXCEPTION 'admin_users rowcount drift';           END IF;

  -- The subject_xor check must reference the renamed column.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'enrollments'
      AND c.conname = 'enrollments_subject_xor'
      AND pg_get_constraintdef(c.oid) ILIKE '%client_id IS NULL%'
      AND pg_get_constraintdef(c.oid) ILIKE '%group_entity_id IS NULL%'
  ) THEN
    RAISE EXCEPTION 'enrollments_subject_xor does not reference renamed columns';
  END IF;

  -- Role enum has new values.
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'organization_user_role' AND e.enumlabel = 'org_admin'
  ) THEN
    RAISE EXCEPTION 'organization_user_role enum missing org_admin value';
  END IF;

  -- New helper functions exist; old ones do not.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'current_organization_id'
  ) THEN
    RAISE EXCEPTION 'private.current_organization_id() missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname IN ('current_client_id', 'is_client_admin')
  ) THEN
    RAISE EXCEPTION 'old private helper still present';
  END IF;

  RAISE NOTICE 'Rename verification passed.';
END;
$$;

COMMIT;
