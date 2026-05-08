-- =============================================================================
-- Security hardening (per Supabase advisors)
-- =============================================================================
-- 1. Move RLS helper functions out of the PostgREST-exposed `public` schema
--    into a `private` schema so they aren't callable via /rest/v1/rpc/*.
-- 2. Lock down trigger functions (revoke EXECUTE from anon/authenticated/PUBLIC).
-- 3. Add explicit search_path to set_updated_at.
--
-- After this migration:
--   - All RLS policies reference private.is_admin(), private.current_client_id(),
--     and private.is_client_admin() instead of the public versions.
--   - The `public` schema no longer contains is_admin / current_client_id /
--     is_client_admin functions at all.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ── Drop existing policies that reference public helpers ─────────────────────
DROP POLICY IF EXISTS "clients_admin_all" ON "clients";
DROP POLICY IF EXISTS "clients_client_select_own" ON "clients";
DROP POLICY IF EXISTS "client_settings_admin_all" ON "client_settings";
DROP POLICY IF EXISTS "client_settings_client_select_own" ON "client_settings";
DROP POLICY IF EXISTS "admin_users_admin_all" ON "admin_users";
DROP POLICY IF EXISTS "admin_users_self_select" ON "admin_users";
DROP POLICY IF EXISTS "client_users_admin_all" ON "client_users";
DROP POLICY IF EXISTS "client_users_client_admin_manage" ON "client_users";
DROP POLICY IF EXISTS "client_users_client_viewer_select" ON "client_users";
DROP POLICY IF EXISTS "client_users_self_select" ON "client_users";
DROP POLICY IF EXISTS "providers_admin_all" ON "providers";
DROP POLICY IF EXISTS "providers_client_select_own" ON "providers";
DROP POLICY IF EXISTS "group_entities_admin_all" ON "group_entities";
DROP POLICY IF EXISTS "group_entities_client_select_own" ON "group_entities";
DROP POLICY IF EXISTS "payers_authenticated_select" ON "payers";
DROP POLICY IF EXISTS "payers_admin_write" ON "payers";
DROP POLICY IF EXISTS "enrollments_admin_all" ON "enrollments";
DROP POLICY IF EXISTS "enrollments_client_select_own" ON "enrollments";
DROP POLICY IF EXISTS "comments_admin_all" ON "comments";
DROP POLICY IF EXISTS "comments_client_select_own" ON "comments";
DROP POLICY IF EXISTS "comments_client_insert_own" ON "comments";
DROP POLICY IF EXISTS "comments_client_self_update" ON "comments";
DROP POLICY IF EXISTS "internal_notes_admin_all" ON "internal_notes";
DROP POLICY IF EXISTS "documents_admin_all" ON "documents";
DROP POLICY IF EXISTS "documents_client_select_own" ON "documents";
DROP POLICY IF EXISTS "status_history_admin_select" ON "status_history";
DROP POLICY IF EXISTS "status_history_admin_insert" ON "status_history";
DROP POLICY IF EXISTS "status_history_client_select_own" ON "status_history";
DROP POLICY IF EXISTS "activity_events_admin_all" ON "activity_events";
DROP POLICY IF EXISTS "activity_events_client_select_own" ON "activity_events";

-- ── Drop public helper functions ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.current_client_id();
DROP FUNCTION IF EXISTS public.is_client_admin();

-- ── Recreate helpers in private schema ───────────────────────────────────────
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.current_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.client_users
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.is_client_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE id = auth.uid() AND is_active = true AND role = 'client_admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_client_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_client_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_client_admin() TO authenticated;

-- ── Lock down trigger functions ──────────────────────────────────────────────
ALTER FUNCTION public.set_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_enrollment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_recred_due_date() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_audit_mutation() FROM PUBLIC, anon, authenticated;

-- ── Re-create policies using private.* helpers ───────────────────────────────
CREATE POLICY "clients_admin_all" ON "clients"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "clients_client_select_own" ON "clients"
  FOR SELECT TO authenticated
  USING (id = private.current_client_id());

CREATE POLICY "client_settings_admin_all" ON "client_settings"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "client_settings_client_select_own" ON "client_settings"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "admin_users_admin_all" ON "admin_users"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "admin_users_self_select" ON "admin_users"
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "client_users_admin_all" ON "client_users"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "client_users_client_admin_manage" ON "client_users"
  FOR ALL TO authenticated
  USING (private.is_client_admin() AND client_id = private.current_client_id())
  WITH CHECK (private.is_client_admin() AND client_id = private.current_client_id());

CREATE POLICY "client_users_client_viewer_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "client_users_self_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "providers_admin_all" ON "providers"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "providers_client_select_own" ON "providers"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "group_entities_admin_all" ON "group_entities"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "group_entities_client_select_own" ON "group_entities"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "payers_authenticated_select" ON "payers"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payers_admin_write" ON "payers"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "enrollments_admin_all" ON "enrollments"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "enrollments_client_select_own" ON "enrollments"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "comments_admin_all" ON "comments"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "comments_client_select_own" ON "comments"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "comments_client_insert_own" ON "comments"
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = private.current_client_id()
    AND author_user_id = auth.uid()
  );

CREATE POLICY "comments_client_self_update" ON "comments"
  FOR UPDATE TO authenticated
  USING (
    client_id = private.current_client_id()
    AND author_user_id = auth.uid()
    AND deleted_at IS NULL
    AND created_at > now() - interval '15 minutes'
  )
  WITH CHECK (
    client_id = private.current_client_id()
    AND author_user_id = auth.uid()
  );

CREATE POLICY "internal_notes_admin_all" ON "internal_notes"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "documents_admin_all" ON "documents"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "documents_client_select_own" ON "documents"
  FOR SELECT TO authenticated
  USING (
    client_id = private.current_client_id()
    AND is_internal = false
    AND deleted_at IS NULL
  );

CREATE POLICY "status_history_admin_select" ON "status_history"
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY "status_history_admin_insert" ON "status_history"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "status_history_client_select_own" ON "status_history"
  FOR SELECT TO authenticated
  USING (client_id = private.current_client_id());

CREATE POLICY "activity_events_admin_all" ON "activity_events"
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "activity_events_client_select_own" ON "activity_events"
  FOR SELECT TO authenticated
  USING (
    client_id = private.current_client_id()
    AND action IN (
      'create', 'update',
      'status_change', 'comment_post',
      'document_upload', 'export'
    )
  );
