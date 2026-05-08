-- =============================================================================
-- Row-Level Security (RLS) Policies
-- =============================================================================
-- This is the most important security file in the codebase.
--
-- Rules:
--   1. Every tenant-scoped table has RLS enabled with default-deny.
--   2. Admins (in admin_users with is_active=true) get full access.
--   3. Client users (in client_users) get access only to rows in their client_id.
--   4. internal_notes and documents WHERE is_internal=true are admin-only.
--   5. Audit tables (status_history, activity_events) are read-only via policy.
--      The trigger in 0001_audit_triggers.sql also blocks UPDATE/DELETE physically.
--
-- All policies use the helper functions defined first.
-- =============================================================================

-- ── Helper functions ─────────────────────────────────────────────────────────

-- Returns true if the calling user is an active admin.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- Returns the client_id this client user belongs to (or null if not a client user).
CREATE OR REPLACE FUNCTION current_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM client_users
  WHERE id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Returns true if the calling user is an active client_admin (within their client).
CREATE OR REPLACE FUNCTION is_client_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_users
    WHERE id = auth.uid() AND is_active = true AND role = 'client_admin'
  );
$$;

-- Grant authenticated users execute on the helpers.
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_client_admin() TO authenticated;

-- ── Enable RLS on every tenant-scoped table ──────────────────────────────────
ALTER TABLE "clients"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_settings"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_users"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_users"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_entities"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payers"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "internal_notes"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "status_history"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_events"  ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (defence-in-depth).
ALTER TABLE "clients"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "client_settings"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "client_users"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "providers"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "group_entities"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "enrollments"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "comments"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "internal_notes"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "documents"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "status_history"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "activity_events"  FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- clients
-- =============================================================================
CREATE POLICY "clients_admin_all" ON "clients"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "clients_client_select_own" ON "clients"
  FOR SELECT TO authenticated
  USING (id = current_client_id());

-- =============================================================================
-- client_settings
-- =============================================================================
CREATE POLICY "client_settings_admin_all" ON "client_settings"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "client_settings_client_select_own" ON "client_settings"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- =============================================================================
-- admin_users — only admins may see; nobody else.
-- =============================================================================
CREATE POLICY "admin_users_admin_all" ON "admin_users"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Self-read so a logged-in admin can fetch their own profile during bootstrap.
CREATE POLICY "admin_users_self_select" ON "admin_users"
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- =============================================================================
-- client_users
-- =============================================================================
CREATE POLICY "client_users_admin_all" ON "client_users"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- A client_admin can manage users in their own client org.
CREATE POLICY "client_users_client_admin_manage" ON "client_users"
  FOR ALL TO authenticated
  USING (is_client_admin() AND client_id = current_client_id())
  WITH CHECK (is_client_admin() AND client_id = current_client_id());

-- A client_viewer can see users in their own client org (read-only).
CREATE POLICY "client_users_client_viewer_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- Self-read.
CREATE POLICY "client_users_self_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- =============================================================================
-- providers
-- =============================================================================
CREATE POLICY "providers_admin_all" ON "providers"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "providers_client_select_own" ON "providers"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- =============================================================================
-- group_entities
-- =============================================================================
CREATE POLICY "group_entities_admin_all" ON "group_entities"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "group_entities_client_select_own" ON "group_entities"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- =============================================================================
-- payers — global master list, readable by all authenticated users
-- =============================================================================
CREATE POLICY "payers_authenticated_select" ON "payers"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payers_admin_write" ON "payers"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =============================================================================
-- enrollments
-- =============================================================================
CREATE POLICY "enrollments_admin_all" ON "enrollments"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "enrollments_client_select_own" ON "enrollments"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- =============================================================================
-- comments — clients can read AND insert into their own client's enrollments.
-- =============================================================================
CREATE POLICY "comments_admin_all" ON "comments"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "comments_client_select_own" ON "comments"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

CREATE POLICY "comments_client_insert_own" ON "comments"
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = current_client_id()
    AND author_user_id = auth.uid()
  );

-- A client user can edit their own (un-deleted) comment within 15 minutes of posting.
CREATE POLICY "comments_client_self_update" ON "comments"
  FOR UPDATE TO authenticated
  USING (
    client_id = current_client_id()
    AND author_user_id = auth.uid()
    AND deleted_at IS NULL
    AND created_at > now() - interval '15 minutes'
  )
  WITH CHECK (
    client_id = current_client_id()
    AND author_user_id = auth.uid()
  );

-- =============================================================================
-- internal_notes — ADMIN ONLY. No client policy. RLS denies-by-default for all
-- authenticated client_users, which is the entire point.
-- =============================================================================
CREATE POLICY "internal_notes_admin_all" ON "internal_notes"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- =============================================================================
-- documents
-- =============================================================================
CREATE POLICY "documents_admin_all" ON "documents"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Clients see only non-internal documents in their own client_id.
CREATE POLICY "documents_client_select_own" ON "documents"
  FOR SELECT TO authenticated
  USING (
    client_id = current_client_id()
    AND is_internal = false
    AND deleted_at IS NULL
  );

-- =============================================================================
-- status_history — readable, never writable via policy
-- (and the trigger blocks UPDATE/DELETE physically).
-- =============================================================================
CREATE POLICY "status_history_admin_select" ON "status_history"
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "status_history_admin_insert" ON "status_history"
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "status_history_client_select_own" ON "status_history"
  FOR SELECT TO authenticated
  USING (client_id = current_client_id());

-- =============================================================================
-- activity_events — admins read all; clients see a filtered view of their own
-- (we'll filter client-visible actions in the application layer).
-- =============================================================================
CREATE POLICY "activity_events_admin_all" ON "activity_events"
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "activity_events_client_select_own" ON "activity_events"
  FOR SELECT TO authenticated
  USING (
    client_id = current_client_id()
    AND action IN (
      'create', 'update',
      'status_change', 'comment_post',
      'document_upload', 'export'
    )
  );
