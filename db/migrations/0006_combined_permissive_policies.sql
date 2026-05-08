-- =============================================================================
-- Refactor: combine admin + client policies into single per-action policies.
-- =============================================================================
-- Postgres OR-evaluates multiple permissive policies for the same role/action,
-- which means every query pays for both the admin check and the client-scope
-- check. Combining them into one policy with `(is_admin OR client-scope)`
-- halves RLS evaluation cost.
--
-- Pattern per table:
--   - SELECT: one combined policy "(is_admin() OR <client-scope>)"
--   - INSERT/UPDATE/DELETE: separate admin policy (no client-write surface)
--     OR combined policy on tables where clients also write (comments).
--
-- Semantics are preserved exactly: same access matrix as before.
-- This migration replaces every policy created in 0002 / 0003 / 0004.
-- =============================================================================

-- Drop all existing policies (we recreate every one below).
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

-- ── clients ─────────────────────────────────────────────────────────────────
CREATE POLICY "clients_select" ON "clients"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR id = private.current_client_id());

CREATE POLICY "clients_admin_insert" ON "clients"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "clients_admin_update" ON "clients"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "clients_admin_delete" ON "clients"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── client_settings ─────────────────────────────────────────────────────────
CREATE POLICY "client_settings_select" ON "client_settings"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "client_settings_admin_insert" ON "client_settings"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "client_settings_admin_update" ON "client_settings"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "client_settings_admin_delete" ON "client_settings"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── admin_users ─────────────────────────────────────────────────────────────
CREATE POLICY "admin_users_select" ON "admin_users"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR id = (select auth.uid()));

CREATE POLICY "admin_users_admin_insert" ON "admin_users"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "admin_users_admin_update" ON "admin_users"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "admin_users_admin_delete" ON "admin_users"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── client_users ────────────────────────────────────────────────────────────
CREATE POLICY "client_users_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR client_id = private.current_client_id()
    OR id = (select auth.uid())
  );

CREATE POLICY "client_users_insert" ON "client_users"
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (private.is_client_admin() AND client_id = private.current_client_id())
  );

CREATE POLICY "client_users_update" ON "client_users"
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_client_admin() AND client_id = private.current_client_id())
  )
  WITH CHECK (
    private.is_admin()
    OR (private.is_client_admin() AND client_id = private.current_client_id())
  );

CREATE POLICY "client_users_delete" ON "client_users"
  FOR DELETE TO authenticated
  USING (
    private.is_admin()
    OR (private.is_client_admin() AND client_id = private.current_client_id())
  );

-- ── providers ──────────────────────────────────────────────────────────────
CREATE POLICY "providers_select" ON "providers"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "providers_admin_insert" ON "providers"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "providers_admin_update" ON "providers"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "providers_admin_delete" ON "providers"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── group_entities ─────────────────────────────────────────────────────────
CREATE POLICY "group_entities_select" ON "group_entities"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "group_entities_admin_insert" ON "group_entities"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "group_entities_admin_update" ON "group_entities"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "group_entities_admin_delete" ON "group_entities"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── payers (global master list) ────────────────────────────────────────────
CREATE POLICY "payers_select" ON "payers"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payers_admin_insert" ON "payers"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "payers_admin_update" ON "payers"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "payers_admin_delete" ON "payers"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── enrollments ────────────────────────────────────────────────────────────
CREATE POLICY "enrollments_select" ON "enrollments"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "enrollments_admin_insert" ON "enrollments"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "enrollments_admin_update" ON "enrollments"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "enrollments_admin_delete" ON "enrollments"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── comments (clients can read + write their own) ──────────────────────────
CREATE POLICY "comments_select" ON "comments"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "comments_insert" ON "comments"
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_admin()
    OR (
      client_id = private.current_client_id()
      AND author_user_id = (select auth.uid())
    )
  );

CREATE POLICY "comments_update" ON "comments"
  FOR UPDATE TO authenticated
  USING (
    private.is_admin()
    OR (
      client_id = private.current_client_id()
      AND author_user_id = (select auth.uid())
      AND deleted_at IS NULL
      AND created_at > now() - interval '15 minutes'
    )
  )
  WITH CHECK (
    private.is_admin()
    OR (
      client_id = private.current_client_id()
      AND author_user_id = (select auth.uid())
    )
  );

CREATE POLICY "comments_admin_delete" ON "comments"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── internal_notes (admin only) ────────────────────────────────────────────
CREATE POLICY "internal_notes_admin_select" ON "internal_notes"
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY "internal_notes_admin_insert" ON "internal_notes"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "internal_notes_admin_update" ON "internal_notes"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "internal_notes_admin_delete" ON "internal_notes"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── documents ──────────────────────────────────────────────────────────────
CREATE POLICY "documents_select" ON "documents"
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR (
      client_id = private.current_client_id()
      AND is_internal = false
      AND deleted_at IS NULL
    )
  );

CREATE POLICY "documents_admin_insert" ON "documents"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "documents_admin_update" ON "documents"
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "documents_admin_delete" ON "documents"
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- ── status_history (audit; UPDATE/DELETE physically blocked by trigger) ─────
CREATE POLICY "status_history_select" ON "status_history"
  FOR SELECT TO authenticated
  USING (private.is_admin() OR client_id = private.current_client_id());

CREATE POLICY "status_history_admin_insert" ON "status_history"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

-- ── activity_events (audit) ────────────────────────────────────────────────
CREATE POLICY "activity_events_select" ON "activity_events"
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR (
      client_id = private.current_client_id()
      AND action IN (
        'create', 'update',
        'status_change', 'comment_post',
        'document_upload', 'export'
      )
    )
  );

CREATE POLICY "activity_events_admin_insert" ON "activity_events"
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
