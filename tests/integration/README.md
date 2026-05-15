# RLS integration tests

These tests assert the multi-tenancy guarantees CLAUDE.md §3 calls non-negotiable: every tenant-scoped table denies cross-tenant access, and `internal_notes` / internal documents never reach a client session. The tests run against a real local Supabase stack — not mocks — because RLS bugs are silent and catastrophic, and only end-to-end execution catches policy drift.

## One-time setup

1. **Docker Desktop** — running, no specific config needed.
2. **Supabase CLI** —
   ```
   brew install supabase/tap/supabase
   ```

## Running the suite

```
pnpm test:rls          # one-shot
pnpm test:rls:watch    # watch mode
```

First boot pulls Docker images and applies all migrations — expect ~30s. Subsequent runs reuse the stack and take a few seconds.

The bootstrap (`tests/integration/global-setup.ts`):

1. Calls `supabase start` if the stack isn't running.
2. Reads `supabase status -o env` to learn the local URL and keys, exports them as `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`.
3. Runs `tsx db/migrate.ts` against the local DB so the schema mirrors production.

Each test file calls `seedFixture()` in `beforeAll`. The fixture wipes every tenant table, recreates two orgs (Alpha and Bravo) with their own users/clinicians/enrollments/documents/notes/comments, and returns access tokens for each role.

## Adding a test

1. Pick the table.
2. Look up its policy in `db/migrations/0013_rename_client_to_org_provider_to_client.sql` (or the migration that last touched it) so the assertions match real DDL, not assumed behavior.
3. Use `userClient(seeded.orgA.adminUser.token)` to act as a specific user — the RLS engine reads `auth.uid()` from the JWT and resolves role/org via the helpers in `private.is_admin()` / `private.current_organization_id()`.
4. For SELECT denial, RLS returns an empty set (no error). For INSERT denial, RLS returns an error. For UPDATE/DELETE denial, RLS returns 0 affected rows (no error). Tests must assert the right shape — getting this wrong is a common false-pass.

## Known gaps

The following files are stubs (`it.todo`) — they need to be filled in before this suite is considered comprehensive:

- `organizations.test.ts`
- `organization_settings.test.ts`
- `organization_users.test.ts`
- `clients.test.ts` (clinicians, includes encrypted-column verification)
- `activity_events.test.ts`

The `group_entities` concept was removed in migration 0018; `organization_kind.test.ts` covers the replacement (individual-org single-clinician trigger + `create_individual_organization` RPC + cross-tenant RLS for the singleton clinician).

The five fully-implemented files cover the highest-risk tables: `enrollments`, `internal_notes`, `documents`, `comments`, `status_history`.

## CI

When wiring CI: install Docker and the Supabase CLI in the runner image, run `pnpm test:rls` after `pnpm test`. The first boot is the slow leg; cache the `supabase/.branches` directory to keep it warm across runs.
