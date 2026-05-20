# Dastify Connect — Setup Guide

End-to-end instructions to bring this repo from clean checkout to a running portal.

---

## Prerequisites

- Node.js 22+ (this repo was developed on 25.x)
- pnpm 10+
- A Supabase account (Postgres, Auth, Storage)
- A Microsoft 365 mailbox + Entra app registration (transactional email via Graph — see §4)
- A Hostinger VPS for production (Coolify — see §8)

---

## 1. Clone & install

```bash
pnpm install
cp .env.example .env.local
```

Open `.env.local` and fill in values from steps 2–5.

---

## 2. Supabase project

1. Create a project at <https://supabase.com>. Note: keep the region close to your users.
2. **Project Settings → API**:
   - Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only — never expose**)
3. **Project Settings → Database**:
   - Copy the **Connection string (Direct connection, port 5432)**, replace `[YOUR-PASSWORD]`, set as `DATABASE_URL`.
   - The pooled connection (port 6543) does NOT work for DDL migrations; use the direct one.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` for dev, your Vercel URL for prod.
   - Redirect URLs: include `http://localhost:3000/auth/callback` and your prod equivalent.
5. **Authentication → Email Templates**: customize the magic-link email body if desired.

### Apply migrations

```bash
pnpm db:migrate
```

This applies, in order:
- `0000_initial_schema.sql` — extensions, tables, indexes, constraints
- `0001_audit_triggers.sql` — status-change logging, recred-due computation, append-only audit
- `0002_rls_policies.sql` — RLS on every table, helper functions

### Seed payer master list

```bash
pnpm db:seed
```

### Generate the field-encryption key

```bash
openssl rand -base64 48
```

Set as `PGCRYPTO_SYMMETRIC_KEY` in `.env.local`. **Rotating this key requires re-encrypting all encrypted columns** — defer rotation until you have a runbook.

---

## 3. Create your first admin user

The portal has no self-signup. The first admin must be inserted manually.

```sql
-- 1) Create the auth user via Supabase Dashboard → Authentication → Users → Add user
-- 2) Then run this in the SQL editor with the new user's UUID:

INSERT INTO admin_users (id, email, full_name, role, is_active)
VALUES (
  'PASTE-AUTH-USER-UUID-HERE',
  'admin@dastify.com',
  'First Admin',
  'admin',
  true
);
```

Now sign in at `/login` with that email — you'll receive a magic link.

---

## 4. Email (Microsoft Graph)

All app transactional email goes through `lib/email/client.ts` → Microsoft Graph `sendMail` using app-only OAuth (client_credentials grant) as `digital@dastifysolutions.com`. Microsoft is actively deprecating basic SMTP AUTH and Graph is the supported long-term path.

### Admin setup (one-time, done by an M365 admin)

1. **Register the app.** Entra ID (Azure AD) → App registrations → **New registration**. Name: `dastify-portal-mail`. Supported account types: *Accounts in this organizational directory only* (single tenant). No redirect URI required.
2. **Grant the `Mail.Send` permission.** API permissions → Add a permission → **Microsoft Graph** → **Application permissions** → `Mail.Send`. Then click **Grant admin consent for [tenant]**.
3. **Create a client secret.** Certificates & secrets → New client secret. Expiry 24 months. Copy the *Value* immediately — Microsoft only shows it once. Note the expiry date on a shared calendar so it can be rotated before it dies.
4. **Scope the app to one mailbox** (security-critical — without this, the app can technically send-as *any* mailbox in the tenant). In an Exchange Online PowerShell session:
   ```powershell
   New-DistributionGroup -Name "DastifyAppSenders" -Members digital@dastifysolutions.com -Type Security
   New-ApplicationAccessPolicy `
     -AppId <client-id-from-step-1> `
     -PolicyScopeGroupId DastifyAppSenders `
     -AccessRight RestrictAccess `
     -Description "Restrict dastify-portal-mail to digital@ only"
   Test-ApplicationAccessPolicy -Identity digital@dastifysolutions.com -AppId <client-id>
   ```
   The `Test-` line should report `AccessCheckResult: Granted` for `digital@` and `Denied` for any other mailbox.

The admin hands back: **Tenant ID**, **Application (client) ID**, **Client secret value**.

### Developer setup

Fill `.env.local`:
```
MS_GRAPH_TENANT_ID=<tenant id>
MS_GRAPH_CLIENT_ID=<application/client id>
MS_GRAPH_CLIENT_SECRET=<secret value>
MAIL_FROM_USER_ID=digital@dastifysolutions.com
MAIL_FROM_NAME=Dastify Connect
```

### Supabase Auth emails (Send Email Hook → Graph)

Supabase Auth (invites, magic links, password resets, email-change confirmations) sends from Supabase's own infrastructure. Its built-in custom-SMTP feature only supports SMTP basic auth — **not** OAuth/Graph. To keep *all* email on Graph/OAuth (no SMTP password anywhere), we use Supabase's **Send Email Hook**: Supabase calls our endpoint instead of sending the email itself, and our endpoint sends via the same `lib/email/client.ts` Graph wrapper.

The pieces are already built:

- `app/api/auth/send-email/route.ts` — the hook endpoint (verifies the Standard Webhooks signature, then sends via Graph).
- `lib/email/auth-templates.ts` — per-action templates (signup, invite, magic link, recovery, email change, reauthentication, generic fallback).
- `middleware.ts` — `/api/auth/send-email` is public (it self-authenticates via the signature).
- `SEND_EMAIL_HOOK_SECRET` env var.

To enable it:

1. Supabase dashboard → **Authentication** → **Hooks** (or **Auth Hooks**) → **Send Email Hook**.
2. Choose **HTTPS** hook type. Set the URL to your deployed endpoint: `https://<prod-host>/api/auth/send-email` (for local testing against a tunnel, use the tunnel URL).
3. Supabase generates a **signing secret** (format `v1,whsec_…`). Copy it into `SEND_EMAIL_HOOK_SECRET` in `.env.local` (and Vercel/host env). Redeploy so the route picks it up.
4. **Enable** the hook.
5. **Disable custom SMTP** (Authentication → Emails → SMTP settings) if it was on — otherwise Supabase may try both. With the hook enabled, Supabase routes email to the hook.
6. Test: trigger a password reset (or invite a test user) and confirm the email arrives from `digital@dastifysolutions.com` via Graph.

Notes:

- The hook URL must be publicly reachable by Supabase. Localhost won't work — use a deployed URL or a tunnel (e.g. `ngrok`) during development.
- If the hook endpoint is down, auth emails fail (users can't get invites/resets). Auth email now depends on the app deployment being healthy — monitor it.
- The verify link in each email points at `https://<project-ref>.supabase.co/auth/v1/verify?...` (built from the hook's `token_hash` + `redirect_to`), so the existing `/auth/callback` flow is unchanged.

See CLAUDE.md §10 for the cross-cutting checklist.

### Emergency SMTP fallback

If Graph breaks (expired secret, revoked consent, prolonged Graph outage), `.env.local` contains a commented-out **O365 SMTP** block for the same `digital@dastifysolutions.com` mailbox. Procedure:

1. Uncomment the `SMTP_*` block in `.env.local`. Comment the `MS_GRAPH_*` block.
2. Restore the nodemailer version of `lib/email/client.ts` from git (`git show <pre-restore-sha>:lib/email/client.ts > lib/email/client.ts`) and re-add `nodemailer` + `@types/nodemailer` to `package.json`.
3. `pnpm install` and redeploy.

Total ~5 minutes. Designed as a *manual* fallback, not a runtime one — code-level fallback would mask Graph failures that need admin attention (expired secret, revoked permission).

Note: the SMTP password currently stored in the commented block is the mailbox's *account* password. Before relying on this fallback in production, generate a dedicated **app password** at <https://mysignins.microsoft.com/security-info> and substitute it — leaked account passwords grant full mailbox access; app passwords are SMTP-only.

---

## 5. Background jobs (cron-driven outbox)

App notification emails (status changes, comments, digests) run on a durable DB outbox, not an external job runner — so it ports cleanly to a VPS.

- DB triggers (migration 0019) enqueue rows into `notification_queue` atomically when an enrollment status changes or a comment is posted.
- `/api/cron/notifications` drains the queue and sends via Graph; `/api/cron/digest` sends per-org daily digests (and weekly on Mondays). The status/comment server actions also drain immediately via Next.js `after()` for low-latency delivery.
- Both cron endpoints require `Authorization: Bearer <CRON_SECRET>`.

**Setup:**

1. Set `CRON_SECRET` in env (generate: `openssl rand -base64 32`). On Vercel it's also added as an env var; Vercel Cron injects the bearer header automatically.
2. **On Vercel**: `vercel.json` already declares the cron schedules (daily on Hobby; `after()` covers real-time). Nothing else to do.
3. **On the VPS** (production): add to the system crontab, sending the bearer header:
   ```cron
   * * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notifications
   0 14 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/digest
   ```
   (`notifications` every minute for prompt retries; `digest` once daily — it runs the weekly rollup itself on Mondays.)

---

## 6. Run locally

```bash
pnpm dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

After signing in as the first admin, you can:
1. Create a Client (`+ New client`).
2. Invite a Client user via the Client overview page.
3. Add Providers and Enrollments.
4. Move Enrollments through the status pipeline.

---

## 7. Tests

```bash
pnpm test            # vitest unit tests
pnpm test:e2e        # playwright (TODO: scenarios)
pnpm typecheck       # tsc --noEmit
pnpm lint            # next lint
```

---

## 8. Deploy to the Hostinger VPS (Dokku)

Production runs on a Hostinger VPS (`187.77.9.149`, Ubuntu 24.04) that already
hosts other apps via **Dokku** (Heroku-style PaaS: git-push deploys, nginx
routing, Let's Encrypt TLS, cron). Dastify Connect is deployed as an **isolated
Dokku app** named `dastify-connect`, built from the repo `Dockerfile` (Next.js
standalone), listening on port 3000.

> **Why not Coolify?** Coolify wants to own ports 80/443 + Docker and would have
> collided with the existing Dokku stack. Dokku already provides the same PaaS
> features, so we add an app rather than introduce a second orchestrator.

> **Compliance note**: a standard Hostinger VPS is not HIPAA-eligible and
> Hostinger doesn't sign a BAA. For real PHI this is a gap — see the bottom of
> this section.

### 8.1 Create the app (one-time, on the VPS)

```bash
dokku apps:create dastify-connect
dokku builder:set dastify-connect selected dockerfile
dokku ports:set dastify-connect http:80:3000
# Temporary URL until the real subdomain is ready (sslip.io resolves to the IP):
dokku domains:set dastify-connect dastify-connect.187-77-9-149.sslip.io
dokku git:set dastify-connect deploy-branch main
```

### 8.2 Environment (the build-time gotcha)

`NEXT_PUBLIC_*` are **inlined at build time**, so they must be passed as Docker
**build args**, not just runtime config (the `Dockerfile` declares them as
`ARG`). They're public values (anon key + URLs), so this is safe:

```bash
dokku docker-options:add dastify-connect build '--build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co'
dokku docker-options:add dastify-connect build '--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>'
dokku docker-options:add dastify-connect build '--build-arg NEXT_PUBLIC_APP_URL=https://<current-domain>'
```

Runtime config (secrets — never build args):

```bash
dokku config:set --no-restart dastify-connect \
  NODE_ENV=production PORT=3000 \
  NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... NEXT_PUBLIC_APP_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... PGCRYPTO_SYMMETRIC_KEY=... \
  MS_GRAPH_TENANT_ID=... MS_GRAPH_CLIENT_ID=... MS_GRAPH_CLIENT_SECRET=... \
  MAIL_FROM_USER_ID=digital@dastifysolutions.com MAIL_FROM_NAME='Dastify Connect' \
  SEND_EMAIL_HOOK_SECRET=... CRON_SECRET=...
```

### 8.3 Deploy (git push from your laptop)

Your SSH key must be registered with Dokku (`dokku ssh-keys:add <name>` on the
VPS — already done for the existing apps' key). Then:

```bash
git remote add dokku dokku@187.77.9.149:dastify-connect
git push dokku main
```

Dokku builds the Dockerfile and releases. Healthchecks confirm port 3000 is
listening. App is then live on the configured domain.

### 8.4 TLS

```bash
dokku letsencrypt:set dastify-connect email <ops-email>
dokku letsencrypt:enable dastify-connect
dokku letsencrypt:cron-job --add   # global auto-renewal (idempotent)
```

Works on the `sslip.io` temp domain too (it resolves to the IP for the HTTP-01
challenge).

### 8.5 Cron

Host crontab calls a root-only script (keeps the secret out of `crontab -l`):

`/usr/local/bin/dastify-cron.sh`:
```sh
#!/bin/sh
SECRET="<CRON_SECRET>"
BASE="https://<current-domain>"
curl -fsS -H "Authorization: Bearer $SECRET" "$BASE/api/cron/$1" >/dev/null 2>&1
```
`crontab -e`:
```cron
* * * * * /usr/local/bin/dastify-cron.sh notifications
0 14 * * * /usr/local/bin/dastify-cron.sh digest
```
(`after()` gives real-time delivery; the minute cron is the retry/backstop. The
digest endpoint runs the weekly rollup itself on Mondays.)

### 8.6 Cutover to the real subdomain (when ready)

1. DNS: A record `app.dastifysolutions.com` → `187.77.9.149`.
2. `dokku domains:add dastify-connect app.dastifysolutions.com` (and optionally
   `dokku domains:remove` the sslip.io one), then `dokku letsencrypt:enable dastify-connect`.
3. **`NEXT_PUBLIC_APP_URL` is build-time** — update *both* the `docker-options`
   build-arg (`docker-options:remove` the old, `:add` the new) **and** the config
   var, then **rebuild**: `dokku ps:rebuild dastify-connect` (config:set alone
   won't re-inline it).
4. Update `BASE` in `/usr/local/bin/dastify-cron.sh`.
5. **Supabase → Auth → URL Configuration**: Site URL + add
   `https://app.dastifysolutions.com/auth/callback` to Redirect URLs.
6. **Supabase → Auth → Hooks → Send Email Hook**: point the URL at
   `https://app.dastifysolutions.com/api/auth/send-email` (secret unchanged).
7. **Decommission Vercel**: remove its cron (delete `vercel.json` or pause the
   project) so you don't run dual crons or a stale auth hook against the same DB.

### When a client requires HIPAA-grade infra

The VPS itself is the compliance gap (no BAA). Options when a real client needs
HIPAA: move compute to a BAA-signing host (AWS/GCP/Azure), keep Supabase on
Pro + HIPAA add-on (signs a BAA; covers the DB + Auth + Storage that hold the
PHI), and ensure email (Microsoft 365) is under a Microsoft BAA. No app code
rework is required — only where it's hosted.

---

## Troubleshooting

**Migrations fail with `permission denied for schema public`**
You're connected via the pooled string. Use the direct connection (port 5432).

**`auth.uid()` is `null` in queries**
You're using the service-role client where you should be using the user-scoped server client. Service-role bypasses RLS and `auth.uid()` returns null. Check `lib/supabase/admin.ts` for the rule.

**Magic-link redirect 404s**
Ensure `http://localhost:3000/auth/callback` is in Supabase's Redirect URLs allow-list.

**`bytea` columns showing as `[Object]` in queries**
The encrypted columns return raw bytea. Use the `decryptColumn()` helper in `lib/security/encryption.ts` to read them, and only in admin-side server components.

---

## Architecture references

- `CLAUDE.md` — system prompt for any AI agent working in the repo
- `docs/DESIGN.md` — full design rationale, schema, RLS sketch, security posture
