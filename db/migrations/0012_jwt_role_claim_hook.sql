-- =============================================================================
-- Custom Access Token Hook — stamp role / client_id into the JWT
-- =============================================================================
-- The middleware previously ran two Supabase queries on every protected
-- request (admin_users + client_users) just to decide which area the user is
-- allowed to enter. That latency landed on every navigation.
--
-- This hook adds a per-user `app_role` (and `client_id` for client users) into
-- the JWT's `app_metadata` claim at token-issue time, so:
--   • Middleware reads the role from the access token (no DB round-trip).
--   • Server components prefer the claim and only query the matching table
--     for the additional profile fields (name, email).
--
-- The hook fires on sign-in and on every refresh, so role changes propagate
-- on the next refresh (≤ 1 hour by default) or immediate re-login. Disabling
-- the hook in the dashboard returns the app to the legacy two-table fallback
-- path with no code change required.
--
-- After applying this migration, the hook must be enabled in the Supabase
-- dashboard: Auth → Hooks → Custom Access Token → public.custom_access_token_hook.
-- This step is tracked in CLAUDE.md §10.
-- =============================================================================

BEGIN;

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
  client_row record;
BEGIN
  user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';
  app_metadata := COALESCE(claims -> 'app_metadata', '{}'::jsonb);

  -- Strip any prior stamps so a role change doesn't leave stale claims behind
  -- if the user moves between admin_users and client_users.
  app_metadata := app_metadata - 'app_role' - 'client_id';

  SELECT is_active
    INTO admin_active
    FROM public.admin_users
   WHERE id = user_id;

  IF admin_active IS TRUE THEN
    app_metadata := app_metadata || jsonb_build_object('app_role', 'admin');
  ELSE
    SELECT role::text AS role, client_id, is_active
      INTO client_row
      FROM public.client_users
     WHERE id = user_id;

    IF client_row.is_active IS TRUE THEN
      app_metadata := app_metadata
        || jsonb_build_object(
             'app_role', client_row.role,
             'client_id', client_row.client_id
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

-- The hook reads admin_users / client_users while running as supabase_auth_admin
-- (SECURITY DEFINER means it runs as the function owner, typically postgres,
-- which already has access). The explicit grants below are belt-and-suspenders
-- in case the function is ever recreated under a less-privileged owner.
GRANT SELECT ON public.admin_users  TO supabase_auth_admin;
GRANT SELECT ON public.client_users TO supabase_auth_admin;

-- Allow supabase_auth_admin to bypass RLS on these two tables when invoked by
-- the hook. Without this, the auth admin role (which has no policies) would
-- get zero rows back.
CREATE POLICY "admin_users_auth_admin_read" ON public.admin_users
  FOR SELECT TO supabase_auth_admin
  USING (true);

CREATE POLICY "client_users_auth_admin_read" ON public.client_users
  FOR SELECT TO supabase_auth_admin
  USING (true);

COMMIT;
