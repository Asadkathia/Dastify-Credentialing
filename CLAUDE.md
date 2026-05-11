# CLAUDE.md — Master Prompt for the Dastify Credentialing Portal

> This file is the system prompt for any AI coding agent working in this repo. Read it fully before reading any other file. The companion design rationale lives in `docs/DESIGN.md`.

---

## 1. What this project is

Dastify is a healthcare payer-enrollment-as-a-service business. This portal is the operational core: Dastify staff use it to manage every provider's enrollment status with every payer, in every US state, across every recredentialing cycle. Client practices log in to see their own data and comment on it.

It replaces a per-client Excel spreadsheet (`States | Payers | Participation Request Status | Comments`) with a multi-tenant web app.

**Two user types**:
- **Admins** (Dastify staff) — full access, single role in v1.
- **Client users** (practice staff) — provisioned by admin invite. Two sub-roles: `client_admin` (manages their org's users) and `client_viewer` (read + comment).

**Core domain unit**: `Enrollment = (Provider OR GroupEntity) × Payer × State × CycleNumber`.

If you don't yet understand why **state** is part of the unique key, read `docs/DESIGN.md` §3 before changing the schema.

---

## 2. Tech stack — locked

Use **only** the following. Do not introduce alternatives without explicit approval.

| Layer | Tool |
|---|---|
| App | Next.js 15 (App Router, RSC) |
| UI | Tailwind CSS + shadcn/ui |
| DB | Postgres on Supabase |
| ORM | Drizzle ORM |
| Auth | Supabase Auth (admin-provisioned invites, magic-link) |
| Storage | Supabase Storage |
| Email | Resend |
| Background jobs | Inngest |
| Logs | Axiom (or Better Stack) |
| Hosting | Vercel |
| Pkg manager | pnpm |
| Lang | TypeScript (strict) |
| Test | Vitest (unit), Playwright (E2E) |

When the user asks for "the simplest path," default to these tools, not new ones.

---

## 3. Non-negotiable rules

These are the rules you must never break. If a request requires breaking one, stop and confirm with the user before proceeding.

### Security & multi-tenancy

1. **Every tenant-scoped table has Row-Level Security enabled, with default-deny policies.** No exceptions. Migrations that create a tenant table without enabling RLS are rejected.
2. **`auth.uid()` is the source of truth for the actor.** Never trust a `client_id` or `user_id` value passed from the client. Derive it from the session.
3. **`internal_notes` and `documents WHERE is_internal = true` are never returned to a client session, ever.** RLS hides them; UI also hides them; double-defense.
4. **Sensitive columns are encrypted at rest with `pgcrypto`**: DEA number, SSN-last-4 (full SSN forbidden), DOB, Tax ID. Never log, return, or export these in plaintext outside the protected detail screens.
5. **No self-signup.** All client users are admin-provisioned via invite. The signup route does not exist.
6. **Audit log is append-only.** No update/delete policies on `status_history` or `activity_events`. Any mutation goes through an insert of a new event row.
7. **No secrets in repo.** Use `.env.local` (gitignored) and Vercel/Supabase env vars.

### Data model integrity

8. **An enrollment is keyed by `(client_id, [provider_id|group_entity_id], payer_id, state, cycle_number)`.** Don't deduplicate by `(provider, payer)` alone — state and cycle are first-class. The unique index is partial — one for individual enrollments, one for group enrollments.
9. **Recredentialing creates a NEW enrollment row** linked via `parent_enrollment_id`. Never reset status on the existing row.
10. **An enrollment has exactly one of `provider_id` or `group_entity_id`** — enforced by a CHECK constraint (`enrollments_subject_xor`).
11. **States are 2-letter US codes everywhere they appear** — `enrollments.state`, `providers.license_states[].state`, `payers.states_active[]`, `group_entities.addresses[].state`. Validated by a DB CHECK (`^[A-Z]{2}$`) on `enrollments.state` and by `US_STATE_REGEX` in Zod for everything else. Never accept lowercase, full state names, or non-US codes.
12. **Provider names are stored split**: `first_name`, `middle_name?`, `last_name`, `suffix?`. Never add a single `name` or `full_name` column. UI display names are computed (`${last}, ${first}${middle ? " " + middle[0] + "." : ""}${suffix ? ", " + suffix : ""}` or similar) — design mockups that show "Dr. Imran Khan" are rendering, not storing.
13. **Provider license states are a jsonb array** of `{ state, licenseNumber, expiration }` on `providers.license_states`. Don't model licenses as a separate table in v1 — the array is intentional and the UI treats it as a sub-grid on the provider detail screen.
14. **Tax ID lives on `group_entities` only** (`tax_id_encrypted`). Providers do **not** have a tax ID column. Designs that show a Tax ID field on a provider are wrong — that field belongs on the group.
15. **Sensitive provider columns are stored encrypted** as bytea via pgcrypto: `dea_number_encrypted`, `ssn_last4_encrypted`, `dob_encrypted`. Read paths must go through the documented decrypt SQL helpers, never `SELECT *`. The plain values never enter logs, exports, or non-detail screens.
16. **Document categories are a runtime-extensible table** (`document_categories`), not an enum. Migration 0008 seeds 11 defaults; admins can add more. Reference categories by `category_id` (FK), never by string name. The legacy `documentCategoryEnum` exists only for the deprecated `legacy_category` column and must not be used in new code.
17. **`payers` is a global, non-tenant-scoped master table.** No `client_id`. Statewise availability is `payers.states_active` (jsonb string[]). Recred interval is `payers.recred_cycle_months` (default 24); apply this when computing `next_recred_due_date` on transition to `effective`.

### Status lifecycle

18. **Status is a closed enum**: `intake`, `prep`, `submitted`, `in_review`, `info_requested`, `approved`, `denied`, `effective`, `closed`, `withdrawn`. The schema also defines `TERMINAL_STATUSES = {closed, withdrawn, effective}` for guard logic.
19. **`sub_status` is free-form `text`, not an enum.** UI may surface a curated list of common phrases (e.g. "Awaiting committee", "Documents collection") as suggestions, but the column accepts any string and `status_history` records both `from_sub_status` and `to_sub_status` as text. Designs that render `sub_status` as a closed dropdown must back it with a free-text fallback.
20. **State transitions are validated server-side.** A transition that violates the documented machine returns `{ ok: false, error }`; it does not silently succeed. Each transition writes one row to `status_history` (append-only).
21. **Setting status to `effective` sets `effective_date` and computes `next_recred_due_date`** = `effective_date + payers.recred_cycle_months` (default 24). This is automatic, not manual.
22. **Denials capture `denied_reason` (text) on the enrollment row** in addition to the status_history entry. The transition modal must collect it; the column is non-null when status is `denied`.

### UX bars

23. **Every list view is paginated.** Never render an unbounded query result.
24. **Every destructive action requires confirmation** — soft delete by default (`deleted_at`); hard delete is admin-only and audit-logged via `activity_events` with `action = "delete"`.
25. **The .xlsx export must reproduce the existing template format exactly**: banner row (configurable from `client_settings.disclaimer_banner_text`), `States | Payers | Participation Request Status | Comments` header, one row per enrollment. The user has clients trained on this layout — do not "improve" it without permission.
26. **The disclaimer banner text is per-client and stored** at `client_settings.disclaimer_banner_text` (default: `"All Insurances take up to 90-120 business days for processing."`). Render it on every client-portal screen and at the top of the .xlsx export.
27. **UI must replicate the design files in `/Dastify-Crendentialing/`** while honoring the data model above. Where a mockup field disagrees with the schema (e.g. provider Tax ID, single `name` field, `sub_status` as enum), the schema wins — adjust the rendering, not the column.

---

## 4. Conventions

### Code organization (when you scaffold)

```
/app               → Next.js App Router routes
  /(admin)         → admin-only routes (route group)
  /(client)        → client-only routes (route group)
  /api             → REST endpoints (used sparingly; prefer server actions)
/db
  /schema          → Drizzle schema definitions
  /migrations      → SQL migrations including RLS policies
  /seed            → Payer master list seed data
/lib
  /auth            → Supabase server client, session helpers
  /rls             → Helpers for RLS-safe queries
  /validation      → Zod schemas (one per entity)
/components
  /ui              → shadcn primitives
  /admin           → admin-only components
  /client          → client-only components
/inngest           → Background job functions
/tests
  /unit            → Vitest
  /e2e             → Playwright
```

### Naming
- Tables: `snake_case`, plural (`enrollments`, `internal_notes`)
- Columns: `snake_case`, no abbreviations (`effective_date`, not `eff_dt`)
- TS types: `PascalCase`; derived from Drizzle inference where possible
- Components: `PascalCase.tsx`
- Server actions: verbs (`createEnrollment`, `transitionStatus`)

### Validation
- Every server action and API route validates input with a Zod schema before touching the DB.
- Output types are inferred from Drizzle, not hand-written.

### Errors
- Server actions return `{ ok: true, data } | { ok: false, error }` shapes — no thrown errors leaking to the client.
- Never expose raw Postgres errors to the user. Map to friendly messages.

### Tests
- Every server action has at least one happy-path test.
- Every RLS-protected query has a test that confirms a cross-tenant attempt fails. **This is mandatory — RLS regressions are silent and catastrophic.**

---

## 5. What to build (v1 scope)

Locked v1 scope. The screens in `/Dastify-Crendentialing/` are the visual target; this list is what they must wire up to.

- Auth + admin-provisioned client invites (Supabase Auth, magic-link). No password, no SSO, no 2FA in v1 (the design's password/SSO/2FA chrome is illustrative; ship magic-link only).
- Multi-tenant data model per `docs/DESIGN.md` §3 and `db/schema/*`.
- **Admin portal** with the consolidated IA the designs use:
  - Dashboard with KPIs, sparklines, throughput line, status donut, recred forecast bar, denial-rate bar, recently-updated table, stuck-in-info_requested table.
  - Network screen — tabbed Clients / Providers / Payers list + inline detail panes.
  - Enrollments list — cross-client, with filter chips, density toggle, bulk-action bar (bulk status update + bulk export).
  - Enrollment detail — status pipeline visualization, Overview / Status History / Documents / Comments / Internal Notes / Activity tabs.
  - Status Transition modal — valid-transition gating, denial reason capture, optional per-transition recipient toggles for the existing email notifications.
  - New Enrollment — multi-state creation (one row per state per CLAUDE.md §3 rule 8).
  - Recreds Pipeline — 12-month forecast chart, derived overdue/at-risk/scheduled views computed from `next_recred_due_date`.
  - Operations — tabbed Documents / Audit Log / Reports with the analytics the dashboard doesn't surface (time-to-effective by payer, throughput by month, submissions by week, denial reasons table).
- **Client portal** — read access scoped via RLS to their own client's data; comment posting; .xlsx export. Mirrors the admin IA but with internal notes / internal documents / staff-perf reports omitted entirely.
- Status pipeline (10 stages + sub-status + denial reason) with server-side transition validation.
- Recred auto-creation Inngest job (90 days before due, with the pipeline screen as the manual-action surface).
- Documents with admin-extensible runtime categories (`document_categories` table), expiration tracking, internal/public flag, virus scanning hook.
- Audit log: `status_history` + `activity_events`, append-only, visible per-enrollment and globally on the Operations → Audit tab.
- .xlsx export matching the existing Excel template.
- Email notifications (Resend): status change, client-comment-to-admin, daily/weekly digest (`client_settings.digest_email_frequency`), expiration alerts (`client_settings.expiration_alert_days_before`).
- Configurable per-client disclaimer banner from `client_settings`.
- Login + audit-logged sessions.

### Out of scope for v1 — push back if asked

AI/agent features, real-time collaboration / live tickers / WebSocket presence, PDF export, in-app notification bell beyond the Inbox screen, SMS, SAML/OIDC SSO (no Google/Microsoft buttons), 2FA, password authentication, CAQH/NPPES integrations, public API/webhooks, mobile native apps, multi-tier admin roles, white-label branding, bulk CSV/XLSX import, staff productivity / per-biller performance metrics.

The Inbox screen (`/Dastify-Crendentialing/Inbox.html`) is **deferred**: the designs treat it as a notification mailbox, but v1 ships email notifications instead. Bring the Inbox in only when the user explicitly approves it for v1.5+.

---

## 6. How to operate in this repo

### Before doing anything

1. Re-read this file. The whole thing. No skimming the rules section.
2. Read `docs/DESIGN.md` §relevant-section.
3. If a `graphify-out/` directory exists, consult it before grepping.

### Before changing the schema

1. Confirm the change is consistent with `docs/DESIGN.md` §3 and the rules in §3 of this file.
2. Add a Drizzle migration **and** the corresponding RLS policy in the same migration file.
3. Add a test that proves cross-tenant access is denied for the new table/column.

### Before adding a new dependency

1. Confirm the locked stack (this file §2) doesn't already cover the use case.
2. Check the package's license, last-publish date, weekly downloads, and known CVEs.
3. Justify in the PR description why it's needed.

### Before merging

- TypeScript strict passes (no `any`, no `@ts-ignore` without a comment explaining why).
- ESLint passes.
- All tests pass, including RLS isolation tests.
- New routes have at least one happy-path E2E.

### When in doubt

Ask the user. Do not invent a product decision (status names, role permissions, export format, notification copy). When the design doc and the user's recent message disagree, the user wins; update the design doc to match.

---

## 7. Anti-patterns — do not do these

- ❌ Adding a `client_id` filter only in the WHERE clause and skipping RLS "because we already filter."
- ❌ Storing full SSN, full driver-license numbers, or any patient data.
- ❌ Hand-writing types that duplicate Drizzle's inferred types.
- ❌ Catching an error and returning a generic 500 — wrap with context.
- ❌ Adding "for future flexibility" abstractions, factory layers, or generic resource APIs.
- ❌ Renaming an existing status enum value to something fancier without checking consumers.
- ❌ Letting the .xlsx export drift from the template format.
- ❌ Using `any`, `unknown` without narrowing, or `// @ts-ignore`.
- ❌ Returning unsanitized user-generated comment HTML — sanitize on render.
- ❌ Sending an email from anywhere other than the Resend wrapper in `/lib/email`.
- ❌ Querying Postgres outside Drizzle (no raw `pg` clients in route handlers).
- ❌ Adding a single `name` / `full_name` column on `providers` — names are split (rule 12).
- ❌ Adding a Tax ID field, column, or form input on a provider — Tax ID lives on `group_entities` only (rule 14).
- ❌ Modeling `sub_status` as an enum, check constraint, or FK to a lookup table — it stays free-form `text` (rule 19).
- ❌ Modeling document categories as an enum extension — extend the `document_categories` table instead (rule 16).
- ❌ Importing `documentCategoryEnum` in new code — it exists only for the deprecated `legacy_category` column.
- ❌ Treating recred "overdue" / "at risk" / "scheduled" as enum values — they are derived views over `next_recred_due_date` deltas, not stored states.
- ❌ Implementing live tickers, presence indicators, or WebSocket subscriptions — v1 is request/response only (out of scope).
- ❌ Implementing the Inbox screen for v1 without explicit approval — designs include it but scope defers it to v1.5+.
- ❌ Wiring Google / Microsoft / SSO buttons on the login screen — magic-link only in v1.
- ❌ Designing per-biller / staff productivity reports — out of scope.
- ❌ Accepting US state codes that aren't 2-letter uppercase ISO — validate everywhere with `US_STATE_REGEX` (`^[A-Z]{2}$`).

---

## 8. Tone and communication with the user

- Direct, technical, no filler.
- When recommending an approach, name the trade-off and recommend the most robust option (per `~/.claude/CLAUDE.md`).
- When the user asks for a quick fix, give them the quick fix AND name the proper fix that's being deferred.
- No emojis unless the user uses them first.
- Code comments only when WHY is non-obvious. Don't narrate WHAT.

---

## 9. References

- `docs/DESIGN.md` — full design rationale, schema details, status pipeline, RLS sketch, security posture
- `docs/UI_DESIGN_PROMPT.md` — master prompt used to generate UI mockups (forward-looking; treats v1 + aspirational as one)
- `/Dastify-Crendentialing/` — the design files the UI must replicate (HTML mockups + JSX). Read these when implementing any screen; they are the visual contract.
- `db/schema/*` — authoritative source for column names, types, and constraints. When the design and the schema disagree, the schema wins (see rule 27).
- Sample report format: `~/Downloads/Credentialing Status Progress Sheet.xlsx` (4-column template, banner disclaimer — match this on .xlsx export)

---

## 10. Pending manual configuration (Supabase dashboard)

These are operational settings that can't be applied via SQL/MCP and must be flipped manually in the Supabase dashboard. Track them here so they don't get lost.

- [ ] **Enable HaveIBeenPwned password check** — Auth → Providers → Email → "Check passwords against HaveIBeenPwned". Surfaced by the security advisor (`auth_leaked_password_protection`). Blocks compromised passwords during sign-up / change. Do this before onboarding any real client.
- [ ] **Auth → URL Configuration** — once we have a production URL (Vercel), add `https://<prod-host>/auth/callback` to the Redirect URLs allow-list.
- [ ] **Storage bucket retention policy** — once `documents` bucket is in use, decide retention (soft-delete via `deleted_at` vs hard-delete from Storage) and configure in Supabase.
- [ ] **Email sender** — Supabase's default sender is rate-limited (~3/hr) and brands as "supabase.io". Before client-facing emails, configure custom SMTP (Resend) under Auth → SMTP Settings.
- [ ] **HIPAA add-on** — when first client requires a BAA, upgrade Supabase to Pro + HIPAA, sign BAA. Architecture already supports this; no code changes.

---

**Last updated**: 2026-05-09 (data-model alignment with design files; states + document_categories codified; UI replicates `/Dastify-Crendentialing/` within schema)
