# Dastify Credentialing Portal — Design Document

**Version**: 1.0
**Date**: 2026-05-08
**Status**: Locked for v1 build

---

> **⚠ Superseded sections (updated 2026-05-15)**
>
> The schema is now the source of truth (CLAUDE.md rule 27). The following parts of this document describe a data model that has been changed by later migrations — read CLAUDE.md and `db/schema/` for the current shape:
>
> - **Terminology rename (migration 0013):** `clients` table → `organizations` (the tenant practice); `providers` table → `clients` (individual clinicians); `client_users` → `organization_users`; column `client_id` (tenancy boundary) → `organization_id`; column `provider_id` (subject) → `client_id`; JWT claim `client_id` → `organization_id`; route `/(client)` → `/(organization)`; roles `client_admin` / `client_viewer` → `org_admin` / `org_viewer`. Everywhere this document says "Client" as the tenant, read "Organization." Everywhere it says "Provider" as the individual clinician, read "Client."
> - **Recredentialing module removed (migrations 0009 + 0010):** `Enrollment` is no longer keyed by a cycle; `next_recred_due_date`, `parent_enrollment_id`, `cycle_number`, `denied_reason`, `payers.recred_cycle_months`, the `compute_recred_due_date()` trigger, and the `recred-check` Inngest job are all gone. Status enum is `prep | submitted | in_review | approved | non_par_credentialed`.
> - **`group_entities` table removed and enrollment subject XOR collapsed (migration 0018):** §3.1 (Enrollment), §3.5 (GroupEntity), §3.7 (Documents `owner_type`), and any RLS sketch that joins through `group_entity_id` are superseded. The current model: **every enrollment subject is a `client_id` (NOT NULL)** keyed `(organization_id, client_id, payer_id, state)` with a partial unique index `WHERE deleted_at IS NULL`. The XOR CHECK is gone. `documents.owner_type` is `provider | enrollment | client` (no `group_entity`).
> - **Organization kind added (migration 0018):** `organizations.kind ∈ {'group', 'individual'}`, default `'group'`, immutable in v1. Individual orgs own exactly one auto-managed `clients` row (enforced by trigger `enforce_individual_org_single_client`). The `create_individual_organization(...)` RPC inserts the org + singleton clinician + settings atomically.
>
> If group-level credentialing (separate group NPI + Tax ID as an enrollment subject) is reintroduced later, it is a fresh feature with a fresh data model — not a revival of the original `group_entities` shape.

---

## 1. Mission

Replace the spreadsheet-based credentialing-status reporting workflow with a multi-tenant web portal where:

- **Dastify staff (admins)** manage the full payer-enrollment lifecycle for each client practice across all of their providers, payers, and US states.
- **Client practices** log in to a real-time view of their enrollment status, comment on individual enrollments, and download .xlsx reports that match the deliverable format their team already knows.

The portal replaces the current Excel template (`States | Payers | Participation Request Status | Comments`) but adds: standardized status vocabulary, audit trail, document handling, multi-user access, notifications, and per-state granularity.

---

## 2. Users & Roles

### Admin (Dastify staff)
- Single role in v1 (`admin`). All admins see all clients.
- Powers: manage clients, providers, enrollments, payers, statuses, comments (public + internal), documents, send invites, export reports.
- Future: split into `super_admin` / `specialist` when team > 5.

### Client users (practice staff)
- Provisioned by admins via invite (no self-signup).
- Two sub-roles:
  - **`client_admin`** — manages their own org's users, full read + comment access.
  - **`client_viewer`** — read + comment access only.
- A single Client org can have multiple users.

### Account provisioning
- Admin creates a Client org → adds a first `client_admin` by email → system sends a magic-link invite via Supabase Auth.
- `client_admin`s can invite additional users within their org.

---

## 3. Data Model (logical)

### Core entities

```
Organization (Dastify itself — singleton in v1)
  └── Admin Users

Client (a practice/group)
  ├── Client Users (client_admin, client_viewer)
  ├── Group Entity (optional — practice-level NPI/Tax ID for group enrollments)
  ├── Providers (individual physicians, NPs, PAs, etc.)
  │     └── Provider Documents (license, DEA, CV, malpractice, CAQH PDF, …)
  └── Enrollments (the "claims")
        ├── Comments (public, threaded)
        ├── Internal Notes (admin-only, threaded)
        ├── Documents (per-enrollment: payer letters, contracts, denials)
        ├── Status History (audit log of state transitions)
        └── Activity Events (audit log of all changes)

Payer (master list of insurance companies)
```

### Enrollment — the load-bearing entity

Each Enrollment record represents **one** of:
`(Provider, Payer, State, Cycle)` **or** `(GroupEntity, Payer, State, Cycle)`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid (FK Client) | tenancy boundary |
| `provider_id` | uuid? (FK Provider) | nullable — set if individual enrollment |
| `group_entity_id` | uuid? (FK GroupEntity) | nullable — set if group enrollment |
| `payer_id` | uuid (FK Payer) | |
| `state` | char(2) | US state code (e.g., `TX`) — NOT NULL |
| `status` | enum | one of 6 canonical values (see §4) |
| `sub_status` | text? | free-form nuance shown beside status |
| `effective_date` | date? | manual override; no longer auto-computed |
| `submitted_at` | timestamptz? | set automatically the first time status hits `submitted` |
| `created_at` / `updated_at` | timestamptz | |

**Constraints**:
- `CHECK ((provider_id IS NOT NULL) <> (group_entity_id IS NOT NULL))` — exactly one of the two is set.
- `UNIQUE (client_id, provider_id, payer_id, state)` for individual enrollments.
- `UNIQUE (client_id, group_entity_id, payer_id, state)` for group enrollments.

**Why state is a column, not a CSV**: many payers operate per-state (Anthem CA ≠ Anthem TX, BCBS is a federation, every Medicaid is per-state). One Aetna application can be approved in TX and pending in NM — that has to be representable.

**Note — recredentialing removed**: migrations 0009 + 0010 dropped `cycle_number`, `parent_enrollment_id`, `next_recred_due_date`, `denied_reason`, and `payers.recred_cycle_months`. If recredentialing comes back as a feature, it's a fresh data model — don't resurrect these columns.

### Provider

Personal identity + credentials shared across all that provider's enrollments.

| Field | Notes |
|---|---|
| `id`, `client_id` | tenancy boundary |
| `first_name`, `last_name`, `middle_name`, `suffix` | |
| `npi` | National Provider Identifier (10-digit) |
| `dea_number` | encrypted with pgcrypto |
| `ssn_last_4` | encrypted; full SSN is **not** stored unless contract requires |
| `dob` | encrypted |
| `primary_specialty`, `secondary_specialty` | |
| `caqh_id` | |
| `license_states` | json array of `{state, license_number, expiration}` |
| `email`, `phone` | |
| `created_at` / `updated_at` | |

### GroupEntity

Practice-level identity for group enrollments.

| Field | Notes |
|---|---|
| `id`, `client_id` | |
| `legal_name`, `dba_name` | |
| `group_npi`, `tax_id` (encrypted), `taxonomy_code` | |
| `addresses` | json — service addresses, billing address |

### Payer (master list)

| Field | Notes |
|---|---|
| `id` | |
| `name` | "Aetna", "BCBS Texas", "Medicare", … |
| `payer_type` | enum: `commercial`, `medicare`, `medicaid`, `tricare`, `other` |
| `states_active` | array of state codes payer operates in |
| `notes` | |

Payers are global (shared across clients), seeded by admins.

### Comments & Internal Notes

Two parallel tables, identical shape, different audiences.

| Field | Notes |
|---|---|
| `id`, `enrollment_id` | scope of the comment |
| `author_user_id` | who wrote it |
| `body` | markdown text |
| `parent_comment_id` | for threaded replies |
| `created_at` / `updated_at` / `deleted_at` | |

- `comments` table: visible to client users and admins.
- `internal_notes` table: admin-only, RLS hides it from any client session entirely.

### Documents

Single `documents` table, polymorphic owner:

| Field | Notes |
|---|---|
| `id`, `client_id` | |
| `owner_type` | enum: `provider`, `enrollment`, `group_entity`, `client` |
| `owner_id` | uuid of the owner |
| `category` | enum: `license`, `dea`, `cv`, `malpractice`, `caqh`, `payer_letter`, `contract`, `denial`, `internal_staging`, `other` |
| `file_path` | Supabase Storage path |
| `file_name`, `mime_type`, `size_bytes` | |
| `expiration_date` | for license/DEA/malpractice — drives expiry alerts |
| `is_internal` | bool — if true, hidden from client users |
| `uploaded_by_user_id` | |
| `created_at` | |

### Audit log

Two complementary tables:

- **`status_history`**: immutable record of every `(enrollment_id, from_status, to_status, changed_by_user_id, reason, changed_at)`. Drives the visible timeline on each enrollment.
- **`activity_events`**: catch-all for every other change — comments added, documents uploaded, fields edited, logins, exports. `(actor_user_id, action, target_table, target_id, diff_json, occurred_at)`.

Both are append-only. No update or delete is permitted (RLS).

### Disclaimer banners

`client_settings`:
- `disclaimer_banner_text` (default: "All Insurances take up to 90–120 business days for processing.")
- `digest_email_frequency` (`off` | `daily` | `weekly`)
- `notify_on_status_change` (bool)

---

## 4. Status Pipeline

Canonical 5 values (enum on `enrollment.status`). Linear happy path — 4 stages:

1. **`prep`** — CAQH up to date, documents collected, application being prepared
2. **`submitted`** — application sent to payer; `submitted_at` is set automatically the first time
3. **`in_review`** — payer is reviewing (absorbs the old "info_requested" / "pending" semantics)
4. **`approved`** — payer accepted the provider; provider is in-network. Terminal happy-path state.

Plus the off-rail terminal:

5. **`non_par_credentialed`** — credentialed but non-participating (provider accepted by payer but not added to the in-network roster).

**Sub-status** is a free-form text field (e.g., "Awaiting CV from provider," "Payer rep escalated," "Contract pending signature"). Renders next to the status chip.

**State machine**: enforced in application logic (not in DB). `lib/enrollment/state-machine.ts` defines the allowed transitions; illegal transitions are blocked with `{ ok: false, error }`. Backwards transitions (e.g., `submitted → prep` to correct a mis-click) are allowed; each one writes a `status_history` row via the `trg_enrollment_status_change` trigger.

**No recredentialing.** There is no auto-creation of cycle-N enrollments, no `next_recred_due_date`, no parent-chain linkage. If recred comes back, it's a fresh feature.

---

## 5. Reports

Two surfaces; one underlying data:

### A) Live dashboard (per client)
- **Default view**: filterable table of all enrollments. Columns: `Provider | State | Payer | Status | Sub-status | Last Activity | Comments`.
- **Filters**: by provider, payer, state, status. (The dashboard's 5 status KPI cards are the primary filter affordance — each card links to `/admin/enrollments?status=X`.)
- **Group-by**: by provider, by payer, by state, by status.
- **Activity feed sidebar**: recent status changes + comments across the client's whole portfolio.
- **Status counters at top**: count per stage.

### B) .xlsx export
- Reproduces the existing Excel template **column-for-column**: `States | Payers | Participation Request Status | Comments`.
- Banner row 1 = the configured `disclaimer_banner_text`.
- Header rows include provider name, NPI, export timestamp.
- One row per enrollment.
- Multi-sheet output if exporting all providers for a client (one sheet per provider).
- Currently no PDF export in v1; revisit if clients ask.

**Snapshots** (deferred): if clients ask for frozen point-in-time reports, add a `report_snapshots` table later that captures rendered .xlsx + status counts per timestamp.

---

## 6. Notifications

All emails sent via Resend.

| Trigger | Recipient | Default | Configurable per-client |
|---|---|---|---|
| Enrollment status change | All client users on that client | On | Yes — toggle off per client |
| Client comment posted | All admins assigned to that client (v1: all admins) | On | No |
| Daily/weekly digest of all activity | Client users | Weekly | Daily / weekly / off |
| Document expiration < 60 days | All admins + client_admins | On | Yes — toggle off, change threshold |
| Recred coming due in 90 days | Admins | On | No |

Inngest schedules: `digest_daily_*` and `digest_weekly_*` cron jobs; on-event triggers for status changes and comments.

In-app notification bell is a v1.1 stretch — emails first.

---

## 7. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| App framework | **Next.js 15** (App Router, RSC) | Mature, audited, secure-by-default; RSC reduces client bundle / attack surface |
| UI | **Tailwind CSS + shadcn/ui** | Accessible primitives, easy to customize, no opinionated lock-in |
| Database | **Postgres on Supabase Pro** (HIPAA add-on when first client requires) | Row-Level Security enforces multi-tenancy at DB layer |
| ORM | **Drizzle ORM** | Plays cleanly with raw SQL + RLS policies; less magic than Prisma |
| Auth | **Supabase Auth** (admin-provisioned invites, magic-link first-login, MFA optional) | Auth identity flows native into RLS — no JWT bridge to misconfigure |
| File storage | **Supabase Storage** with RLS bucket policies + ClamAV scan via Inngest | Per-bucket access control, signed URLs |
| Email | **Resend** | BAA-eligible on Enterprise; clean API |
| Background jobs | **Inngest** | Durable execution, retries, scheduled jobs (digests, expiration alerts, scan hooks) |
| Logs / alerting | **Axiom** or **Better Stack** | Centralized log search + alerts |
| Field-level encryption | **pgcrypto** (built-in to Postgres) | DEA, SSN-last-4, DOB, Tax ID encrypted at column level |
| Hosting | **Vercel** (Pro initially; Enterprise w/ BAA when required) | First-class Next.js host |
| Monorepo / pkg manager | **pnpm** | Fast, deterministic |
| Type-checking / lint | **TypeScript strict** + **ESLint** + **Prettier** | Non-negotiable |
| Testing | **Vitest** (unit), **Playwright** (E2E) | |

### Why Supabase + RLS over Clerk + custom DB

In a multi-tenant client portal, the worst-case bug is one client seeing another client's data. With RLS enforced at the database, **the database itself refuses queries that violate tenancy** — even a buggy API handler cannot leak. With app-layer-only authz (Clerk + naked Postgres), every API route is the only thing standing between tenants; one missed `.where(clientId = ...)` is a breach. For a healthcare-adjacent portal handling provider PII, the RLS path is materially safer.

---

## 8. Security & Compliance

### v1 posture: HIPAA-ready architecture, BAA optional per client

- **Encryption in transit**: TLS 1.2+ everywhere; HSTS preload.
- **Encryption at rest**: AES-256 (Supabase default) + pgcrypto for the truly sensitive columns (DEA, SSN-last-4, DOB, Tax ID).
- **Authentication**: Supabase Auth, password complexity enforced, MFA available for both admin and client users, mandatory for admins.
- **Authorization**: every table has an RLS policy. Default deny.
- **Audit**: every state transition + activity event logged immutably. Logins logged.
- **Backups**: Supabase point-in-time recovery (7-day window on Pro, longer on add-on).
- **Secrets**: only via Vercel/Supabase env vars; never in repo.
- **Dependencies**: Renovate or Dependabot for weekly upgrades; npm audit in CI.
- **Incident response**: log alerts via Axiom; documented runbook (deferred to post-launch).

### When a client demands a BAA
- Upgrade Supabase to HIPAA add-on (~$599/mo)
- Upgrade Vercel to Enterprise w/ BAA
- Switch Resend + Inngest to Enterprise/BAA tiers
- All architectural choices already accommodate this — no code rework.

### What we explicitly do NOT do
- We don't store full SSN or full driver-license numbers unless a payer requires it for a specific enrollment.
- We don't store any patient data — this portal is provider-side only.
- We don't allow self-signup for any role.
- We don't use third-party trackers or analytics that fingerprint users.

---

## 9. RLS Policy Sketch

Every tenant-scoped table has policies enforcing:

```
-- Pseudocode
CREATE POLICY admin_full_access ON <table>
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY client_user_scope ON <table>
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );
```

Special cases:
- `internal_notes`: admin-only — no client policy at all.
- `documents` where `is_internal = true`: same — invisible to client sessions.
- `status_history`, `activity_events`: read-only via policy (no UPDATE/DELETE clause).

---

## 10. Out of scope for v1

- AI/agent features (drafting comments, parsing letters, summarizing reports). Schema is built so AI can be layered in later non-disruptively.
- Real-time collaboration (presence indicators, live cursors).
- PDF export of reports (only .xlsx).
- In-app notification bell (emails first).
- Per-payer credentialing-rep contact directory.
- SMS notifications.
- SAML/OIDC SSO for enterprise clients.
- Automated CAQH or NPPES integrations.
- Public API / webhooks.
- Native mobile apps.
- Three-tier admin roles (super_admin / manager / specialist).
- White-label / per-client branding.

---

## 11. Open questions (track post-MVP)

1. Do client_admins need the ability to **suggest** status changes (request for review) or strictly read+comment?
2. Is there a need for SLA tracking (days-in-stage averages per payer)?
3. Should clients see a per-payer "typical timeline" benchmark beside their pending enrollments?
4. Will we ever ingest enrollments from existing client spreadsheets in bulk? (Bulk import tool — likely yes by month 2.)
