# CLAUDE.md — Master Prompt for the Dastify Credentialing Portal

> This file is the system prompt for any AI coding agent working in this repo. Read it fully before reading any other file. The companion design rationale lives in `docs/DESIGN.md`.

---

## 1. What this project is

Dastify is a healthcare payer-enrollment-as-a-service business. This portal is the operational core: Dastify staff use it to manage every client's (clinician's) enrollment status with every payer, in every US state. Organization users (practice staff) log in to see their own data and comment on it.

It replaces a per-client Excel spreadsheet (`States | Payers | Participation Request Status | Comments`) with a multi-tenant web app.

**Two user types**:
- **Admins** (Dastify staff) — full access, single role in v1.
- **Client users** (practice staff) — provisioned by admin invite. Two sub-roles: `org_admin` (manages their org's users) and `org_viewer` (read + comment).

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
| Email | Microsoft Graph `sendMail` (app-only OAuth) as `digital@dastifysolutions.com`. O365 SMTP via the same mailbox is preserved as a commented manual-swap fallback in `.env.local`. |
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
2. **`auth.uid()` is the source of truth for the actor.** Never trust a `organization_id` or `user_id` value passed from the client. Derive it from the session.
3. **`internal_notes` and `documents WHERE is_internal = true` are never returned to a client session, ever.** RLS hides them; UI also hides them; double-defense.
4. **Sensitive columns are encrypted at rest with `pgcrypto`**: DEA number, SSN-last-4 (full SSN forbidden), DOB, Tax ID. Never log, return, or export these in plaintext outside the protected detail screens.
5. **No self-signup.** All client users are admin-provisioned via invite. The signup route does not exist.
6. **Audit log is append-only.** No update/delete policies on `status_history` or `activity_events`. Any mutation goes through an insert of a new event row.
7. **No secrets in repo.** Use `.env.local` (gitignored) and Vercel/Supabase env vars.

### Data model integrity

8. **An enrollment is keyed by `(organization_id, client_id, payer_id, state)`.** Don't deduplicate by `(client, payer)` alone — state is first-class. The unique index is partial — `WHERE deleted_at IS NULL` so soft-deletes don't block re-enrollment. **No `cycle_number`** (removed in migration 0009 along with the recredentialing module). **No `group_entity_id`** (removed in migration 0018 along with the entire `group_entities` table).
9. *(Rule removed — migration 0018 dropped the `client_id` / `group_entity_id` XOR. Every enrollment subject is a `client_id`.)*
10. **States are 2-letter US codes everywhere they appear** — `enrollments.state`, `clients.license_states[].state`, `payers.states_active[]`. Validated by a DB CHECK (`^[A-Z]{2}$`) on `enrollments.state` and by `US_STATE_REGEX` in Zod for everything else. Never accept lowercase, full state names, or non-US codes.
11. **Provider names are stored split**: `first_name`, `middle_name?`, `last_name`, `suffix?`. Never add a single `name` or `full_name` column. UI display names are computed (`${last}, ${first}${middle ? " " + middle[0] + "." : ""}${suffix ? ", " + suffix : ""}` or similar) — design mockups that show "Dr. Imran Khan" are rendering, not storing.
12. **Client license states are a jsonb array** of `{ state, licenseNumber, expiration }` on `clients.license_states`. Don't model licenses as a separate table in v1 — the array is intentional and the UI treats it as a sub-grid on the client detail screen.
13. *(Rule removed — migration 0018 dropped the `group_entities` table and `tax_id_encrypted` column. If group-level credentialing comes back as a feature, this rule should be re-introduced with the fresh data model.)*
14. **Sensitive client columns (clinicians) are stored encrypted** as bytea via pgcrypto: `dea_number_encrypted`, `ssn_last4_encrypted`, `dob_encrypted`. Read paths must go through the documented decrypt SQL helpers, never `SELECT *`. The plain values never enter logs, exports, or non-detail screens.
15. **Document categories are a runtime-extensible table** (`document_categories`), not an enum. Migration 0008 seeds 11 defaults; admins can add more. Reference categories by `category_id` (FK), never by string name. The legacy `documentCategoryEnum` exists only for the deprecated `legacy_category` column and must not be used in new code.
16. **`payers` is a global, non-tenant-scoped master table.** No `organization_id`. Statewise availability is `payers.states_active` (jsonb string[]). The old `recred_cycle_months` column was removed in migration 0010.

### Status lifecycle

17. **Status is a closed enum**: `prep`, `submitted`, `in_review`, `approved`, `non_par_credentialed`. Linear happy path: `prep → submitted → in_review → approved` (4 stages). `non_par_credentialed` is the off-rail terminal (client (clinician) credentialed but not in-network). The schema defines `TERMINAL_STATUSES = {approved, non_par_credentialed}` for guard logic.
18. **`sub_status` is free-form `text`, not an enum.** UI may surface a curated list of common phrases as suggestions, but the column accepts any string and `status_history` records both `from_sub_status` and `to_sub_status` as text.
19. **State transitions are validated server-side.** A transition that violates the documented machine returns `{ ok: false, error }`; it does not silently succeed. Each transition writes one row to `status_history` (append-only, enforced by `trg_status_history_no_update`).
20. **Setting status to `submitted` for the first time sets `submitted_at`** automatically. `effective_date` is no longer auto-computed — the column remains for manual override only (set when a payer assigns a network-effective date).
21. **There is no recredentialing module.** Migrations 0009 + 0010 removed `next_recred_due_date`, `parent_enrollment_id`, `cycle_number`, `denied_reason`, `payers.recred_cycle_months`, the `compute_recred_due_date()` trigger, and the `recred-check` Inngest job. If recred work needs to come back later, it is a fresh feature with a fresh data model.

### UX bars

22. **Every list view is paginated.** Never render an unbounded query result.
23. **Every destructive action requires confirmation** — soft delete by default (`deleted_at`); hard delete is admin-only and audit-logged via `activity_events` with `action = "delete"`.
24. **The .xlsx export must reproduce the existing template format exactly**: banner row (configurable from `organization_settings.disclaimer_banner_text`), `States | Payers | Participation Request Status | Comments` header, one row per enrollment. The user has clients trained on this layout — do not "improve" it without permission.
25. **The disclaimer banner text is per-client and stored** at `organization_settings.disclaimer_banner_text` (default: `"All Insurances take up to 90-120 business days for processing."`). Render it on every client-portal screen and at the top of the .xlsx export.
26. **UI must replicate the design files in `/Dastify-Crendentialing/`** while honoring the data model above. Where a mockup field disagrees with the schema (Tax ID on a client, single `name` field, `sub_status` as enum, recredentialing surfaces), the schema wins — adjust the rendering, not the column.
27. **Admin dashboards are per-status KPI bands.** Each of the 5 statuses gets its own card with the live count and a click-through to `/admin/enrollments?status=X` (or `/portal/enrollments?status=X`). No recreds-due KPI, no time-to-effective KPI — those concepts no longer exist.
28. **An organization has a `kind ∈ {group, individual}`.** `group` orgs are the existing multi-clinician practice model. `individual` orgs are a solo clinician — they have exactly one non-soft-deleted row in `clients`, auto-created at org creation and enforced by a DB constraint trigger. Kind is immutable in v1 — `updateOrganizationSchema` does not accept it. Individual-org UI hides the Clients sub-list and shows the clinician inline on the org page. Use `create_individual_organization(...)` (SQL function) to insert the org + settings + clinician atomically; never split that into multiple round-trips.

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

- Auth + admin-provisioned client invites (Supabase Auth). Two methods, both shipped: magic-link (Supabase emails) and password (admin sets initial password via `supabase.auth.admin.createUser`, shown once for out-of-band delivery). No SSO, no 2FA in v1.
- Multi-tenant data model per `docs/DESIGN.md` §3 and `db/schema/*`.
- **Admin portal**:
  - Dashboard — 5 status KPI cards (one per enum value), each clickable to `/admin/enrollments?status=X`. Status distribution donut, non-par-credentialed rate by payer, 12-month enrollment-creations bar, recently-updated table, "Monthly report" Excel download.
  - Organizations / Clients / Payers — separate list pages with detail panes.
  - Enrollments list — cross-client, with status filter chips (5 chips), payer + state filters, pagination.
  - Enrollment detail — status pipeline visualization, Overview / Status History / Documents / Comments / Internal Notes / Activity tabs.
  - Status Transition modal — valid-transition gating per the new state machine, free-form reason capture.
  - New Enrollment — one (client × payer × state) per row (no cycle concept, no group subject — every enrollment is a clinician).
  - Documents (cross-client) + Audit Log (cross-client).
- **Client portal** — read access scoped via RLS to their own client's data; comment posting; .xlsx export. Mirrors admin Dashboard (5 status KPI cards, status donut, 12-month creations bar, recently-updated, recent comments). Internal notes and internal documents never appear; non-par rate is admin-only.
- Status pipeline (5 statuses, 4 linear stages) with server-side transition validation.
- Documents with admin-extensible runtime categories (`document_categories` table), expiration tracking, internal/public flag, virus scanning hook.
- Audit log: `status_history` + `activity_events`, append-only, visible per-enrollment and globally on `/admin/audit`.
- .xlsx export matching the existing Excel template — plus a monthly cross-client report at `/api/export/monthly-enrollments.xlsx`.
- **Bulk xlsx import** at `/admin/import` (admin-only). Three entity tabs: Enrollments (legacy 4-column `States | Payers | Participation Request Status | Comments` template; admin picks org + clinician before upload — for `individual` orgs the clinician is resolved server-side from the singleton; multi-state cells expand into one row per state), Clients (clinicians, scoped to one org), Organizations. Two-step flow: parse + preview (row-by-row valid/error/duplicate) → confirm → atomic insert. Duplicates are detected against enrollment unique-key / NPI / legal name and skipped with warning. Caps: 5 MB / 5000 rows. Audit row written as `activity_events.action = 'import'` (added in migration 0014).
- Email notifications (Resend): status change, client-comment-to-admin, daily/weekly digest (`organization_settings.digest_email_frequency`), expiration alerts (`organization_settings.expiration_alert_days_before`).
- Configurable per-client disclaimer banner from `organization_settings`.
- Login + audit-logged sessions.

### Out of scope for v1 — push back if asked

AI/agent features, real-time collaboration / live tickers / WebSocket presence, PDF export, in-app notification bell beyond the Inbox screen, SMS, SAML/OIDC SSO (no Google/Microsoft buttons), 2FA, CAQH/NPPES integrations, public API/webhooks, mobile native apps, multi-tier admin roles, white-label branding, staff productivity / per-biller performance metrics, **recredentialing** (entire module removed in migration 0009 — see rule 21).

The Inbox screen (`/Dastify-Crendentialing/Inbox.html`) and Recreds Pipeline screen are **deferred**: the design files include them but v1 doesn't ship either. Email notifications cover the inbox use case; recreds is out entirely.

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

- ❌ Adding a `organization_id` filter only in the WHERE clause and skipping RLS "because we already filter."
- ❌ Storing full SSN, full driver-license numbers, or any patient data.
- ❌ Hand-writing types that duplicate Drizzle's inferred types.
- ❌ Catching an error and returning a generic 500 — wrap with context.
- ❌ Adding "for future flexibility" abstractions, factory layers, or generic resource APIs.
- ❌ Renaming an existing status enum value to something fancier without checking consumers.
- ❌ Letting the .xlsx export drift from the template format.
- ❌ Using `any`, `unknown` without narrowing, or `// @ts-ignore`.
- ❌ Returning unsanitized user-generated comment HTML — sanitize on render.
- ❌ Sending an email from anywhere other than the Graph wrapper in `/lib/email`. All transactional mail goes through `sendEmail(...)` in `lib/email/client.ts`, which uses Microsoft Graph `sendMail` with app-only OAuth — no nodemailer, no Resend, no direct `fetch` to Graph from anywhere else. If Graph breaks and the emergency SMTP fallback is activated, the wrapper swap also lives in `lib/email/client.ts` (nodemailer version is in git history); do not split the surface.
- ❌ Querying Postgres outside Drizzle (no raw `pg` clients in route handlers).
- ❌ Adding a single `name` / `full_name` column on `providers` — names are split (rule 11).
- ❌ Re-introducing `group_entities`, `enrollments.group_entity_id`, or the `group_entity` value of `document_owner_type` — all three were removed in migration 0018. Every enrollment subject is a `client_id`.
- ❌ Modeling `sub_status` as an enum, check constraint, or FK to a lookup table — it stays free-form `text` (rule 18).
- ❌ Modeling document categories as an enum extension — extend the `document_categories` table instead (rule 15).
- ❌ Importing `documentCategoryEnum` in new code — it exists only for the deprecated `legacy_category` column.
- ❌ Re-introducing `next_recred_due_date`, `parent_enrollment_id`, `cycle_number`, `denied_reason`, or `payers.recred_cycle_months` — the recred module is gone (rule 21). If recredentialing comes back later, it's a new feature with a fresh data model.
- ❌ Referencing the old status enum values in new code (`intake`, `info_requested`, `denied`, `effective`, `closed`, `withdrawn`, `completed`) — they no longer exist. Use the 5 current values (`prep`, `submitted`, `in_review`, `approved`, `non_par_credentialed`).
- ❌ Implementing live tickers, presence indicators, or WebSocket subscriptions — v1 is request/response only (out of scope).
- ❌ Implementing the Inbox screen or Recreds Pipeline for v1 — both deferred / removed.
- ❌ Wiring Google / Microsoft / SSO buttons on the login screen — v1 is email-only (password or magic-link), no federated identity.
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
- [ ] **Configure Auth session timeouts** — Auth → Sessions. Set **inactivity timeout = 30 minutes** and **time-box (absolute session lifetime) = 12 hours** to satisfy HIPAA §164.312(a)(2)(iii) automatic logoff. Confirm **refresh-token rotation is enabled** with **reuse interval = 10 s** (default — detects stolen-token replay). Code-level enforcement in `middleware.ts` mirrors these values via `lib/auth/session-policy.ts`; the dashboard settings are the primary backstop. After applying, run **Auth → Users → "Sign out all users"** so existing forever-sessions are killed before the new policy takes effect.
- [ ] **Re-confirm Custom Access Token hook after migration 0013** — Auth → Hooks → Custom Access Token → ensure `public.custom_access_token_hook` is still selected. Migration 0013 replaced the function body in-place to stamp `organization_id` (not the old `client_id`) into the JWT, but the dashboard pointer must be verified post-deploy. This stamps `app_role` (`admin | org_admin | org_viewer`) and `organization_id` (for org users) so the middleware can gate routes without a DB query per request.
- [ ] **Force-sign-out all users post-rename** — Auth → Users → "Sign out all users" once migration 0013 is applied and the new code is deployed. JWTs issued before the rename still carry the old `client_id` claim and the middleware's claim-reader fallback will probe `organization_users` per request until each user re-logs-in. Required: do this **before** announcing the deploy is complete.
- [ ] **Auth → URL Configuration** — once we have a production URL (Vercel), add `https://<prod-host>/auth/callback` to the Redirect URLs allow-list.
- [ ] **Storage bucket retention policy** — once `documents` bucket is in use, decide retention (soft-delete via `deleted_at` vs hard-delete from Storage) and configure in Supabase.
- [ ] **Email sender (Supabase Auth)** — Supabase's default sender is rate-limited (~3/hr) and brands as "supabase.io". Supabase Auth can only send via SMTP (no Graph integration), so for invites + magic links + password resets we still need SMTP credentials for `digital@dastifysolutions.com`. The IT-preferred path is: ask the admin to enable **Authenticated SMTP** on just that one mailbox (Exchange admin → mailbox → Manage email apps) and provide an app password — used *only* by Supabase Auth, not by the app. The app itself sends via Graph and does not touch SMTP. If the admin refuses SMTP entirely, the fallback is to leave Auth on Supabase's default sender (impractical past pilot) or to write an auth-email proxy that catches Supabase webhooks and re-sends via Graph (real work — defer until forced).
- [x] **Entra ID app registration for Graph `sendMail`** — done 2026-05-20. App `Dastify Credentialing Portal` / client ID `cef20225-5e26-4bff-9815-9feb3a7bfca1` / tenant `23583652-2528-455a-b7db-0f7db773d0dc`. `Mail.Send` Application permission granted with admin consent (verified via decoded token `roles: ["Mail.Send"]`). Client secret created — set a calendar reminder ~30 days before its 24-month expiry to rotate. *Still pending*: confirm `New-ApplicationAccessPolicy` restricts this app to `digital@dastifysolutions.com` only — without it, the app technically has SendAs on every mailbox in the tenant. Verify with `Test-ApplicationAccessPolicy -Identity digital@dastifysolutions.com -AppId cef20225-5e26-4bff-9815-9feb3a7bfca1` (expect `Granted`) and against any other mailbox (expect `Denied`).
- [ ] **HIPAA add-on** — when first client requires a BAA, upgrade Supabase to Pro + HIPAA, sign BAA. Architecture already supports this; no code changes.

---

**Last updated**: 2026-05-14 (rename: `clients` table → `organizations` for tenant; `providers` → `clients` for individual clinicians; `client_users` → `organization_users`; role values `client_admin`/`client_viewer` → `org_admin`/`org_viewer`; JWT claim `client_id` → `organization_id`). Migration 0013 applied. **2026-05-14 (later)**: bulk xlsx import added at `/admin/import` (enrollments + clients + organizations). Migration 0014 adds `'import'` to the `activity_action` enum. **2026-05-15**: migration 0018 splits organizations by `kind ∈ {group, individual}` (individual = singleton clinician, enforced by constraint trigger; `create_individual_organization(...)` SQL helper inserts org+settings+client atomically) **and** drops the entire `group_entities` concept — table, FK `enrollments.group_entity_id`, partial unique index `enrollments_unique_group_idx`, CHECK `enrollments_subject_xor`, and the `group_entity` value of `document_owner_type`. The single remaining uniqueness rule is partial `(organization_id, client_id, payer_id, state) WHERE deleted_at IS NULL`. Rules 9 and 13 retired (see inline annotations); rule 28 added. Phase 2 (UI call-site fixes) and Phase 3 (tests) ship in the same PR. **2026-05-15 (later)**: session-expiry policy added — `lib/auth/session-policy.ts` (30-min idle, 12-h absolute), `middleware.ts` enforces via `dast_activity` cookie + `last_sign_in_at`, `IdleSessionGuard` client warns 60 s before cutoff. CLAUDE.md §10 lists the corresponding dashboard settings. **2026-05-18**: email provider swapped from Resend → Office 365 SMTP via nodemailer (`digital@dastifysolutions.com`, `smtp.office365.com:587`, STARTTLS). `lib/email/client.ts` rewritten; `resend` removed from package.json; `RESEND_*` env vars replaced by `SMTP_HOST/PORT/USER/PASS/FROM`. **2026-05-19**: superseded — Microsoft tenant has `SmtpClientAuthentication` disabled and IT pushed for OAuth instead. App email now uses **Microsoft Graph `sendMail`** with app-only OAuth (client_credentials grant against `login.microsoftonline.com`; cached access token; `POST /v1.0/users/{id}/sendMail`). `lib/email/client.ts` rewritten to native `fetch` (no SDK deps); `nodemailer` + `@types/nodemailer` removed from package.json; `SMTP_*` env vars replaced by `MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET / MAIL_FROM_USER_ID / MAIL_FROM_NAME`. `sendEmail(...)` signature unchanged so callers don't move. Graph body sends HTML only (Graph's structured Message has no native multipart/alternative) — `text` stays in `SendEmailInput` as optional for caller convenience but is currently ignored; switch to the `/sendMail` MIME variant if plaintext-alt becomes a deliverability problem. Credentials pending IT — see §10 for Entra app-registration checklist. **2026-05-20**: temporarily rolled back to SMTP. Entra app registration `cef20225-5e26-4bff-9815-9feb3a7bfca1` is in place and authentication succeeds, but `Mail.Send` admin consent is still not granted (confirmed by decoding the issued access token's `roles` claim being empty across multiple runs over 18+ hours). To unblock the project, `lib/email/client.ts` is back to **nodemailer over SMTP** using **Titan Email** (`smtp.titan.email:587`, STARTTLS, sending as `isaac@dastifydigital.com`). `nodemailer` + `@types/nodemailer` re-added; `SMTP_*` env vars active in `.env.local` with the Graph block commented out (preserved for restoration). **2026-05-20 (later, same day)**: Microsoft Graph `Mail.Send` admin consent finally granted by the IT admin. Smoke test confirmed `roles: ["Mail.Send"]` in the token and `HTTP 202 Accepted` from `/users/digital@dastifysolutions.com/sendMail`. Separately, the IT admin had also enabled Authenticated SMTP on the same mailbox during the back-and-forth, so an O365 SMTP test (`smtp.office365.com:587` as `digital@`) also succeeded — but Graph is the chosen primary because it doesn't require mailbox passwords, has higher rate limits, doesn't depend on the SmtpClientAuthentication toggle staying on, and is Microsoft's recommended long-term path. **Final state**: `lib/email/client.ts` restored to the Graph version (native `fetch`, client_credentials, cached token). `nodemailer` + `@types/nodemailer` removed from package.json again. `MS_GRAPH_*` block active in `.env.local`. Titan creds purged. O365 SMTP creds preserved as a commented block in `.env.local` for manual emergency fallback (procedure: uncomment SMTP block + comment Graph block + restore nodemailer wrapper from git + redeploy, ~5 min). `text` field of `SendEmailInput` is still ignored — Graph sends HTML only; switch to the MIME variant of `/sendMail` if plaintext-alt becomes a deliverability problem.
