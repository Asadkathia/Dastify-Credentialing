-- =============================================================================
-- Performance fixes (per Supabase advisors)
-- =============================================================================
-- 1. Wrap auth.uid() with (select ...) so the planner caches the value per
--    query instead of re-evaluating per row (auth_rls_initplan lint).
-- 2. Add covering indexes for self-referential foreign keys
--    (unindexed_foreign_keys lint).
--
-- The remaining `multiple_permissive_policies` warnings on most tables are
-- intentional for now — admin-all + client-scoped policies live on the same
-- table and Postgres OR-evaluates them. Combining into single per-action
-- policies is a follow-up refactor (see docs/DESIGN.md §11 open questions).
-- =============================================================================

-- ── (1) auth.uid() initplan fix ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_users_self_select" ON "admin_users";
CREATE POLICY "admin_users_self_select" ON "admin_users"
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "client_users_self_select" ON "client_users";
CREATE POLICY "client_users_self_select" ON "client_users"
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "comments_client_insert_own" ON "comments";
CREATE POLICY "comments_client_insert_own" ON "comments"
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = private.current_client_id()
    AND author_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "comments_client_self_update" ON "comments";
CREATE POLICY "comments_client_self_update" ON "comments"
  FOR UPDATE TO authenticated
  USING (
    client_id = private.current_client_id()
    AND author_user_id = (select auth.uid())
    AND deleted_at IS NULL
    AND created_at > now() - interval '15 minutes'
  )
  WITH CHECK (
    client_id = private.current_client_id()
    AND author_user_id = (select auth.uid())
  );

-- ── (2) Covering indexes for self-referential FKs ────────────────────────────
CREATE INDEX IF NOT EXISTS "comments_parent_comment_id_idx"
  ON "comments" ("parent_comment_id")
  WHERE "parent_comment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "internal_notes_parent_note_id_idx"
  ON "internal_notes" ("parent_note_id")
  WHERE "parent_note_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "enrollments_parent_enrollment_id_idx"
  ON "enrollments" ("parent_enrollment_id")
  WHERE "parent_enrollment_id" IS NOT NULL;
