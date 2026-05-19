# Dastify Credentialing — Setup Guide

End-to-end instructions to bring this repo from clean checkout to a running portal.

---

## Prerequisites

- Node.js 22+ (this repo was developed on 25.x)
- pnpm 10+
- A Supabase account
- A Resend account (transactional email)
- An Inngest account (background jobs)
- A Vercel account (when ready to deploy)

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
MAIL_FROM_NAME=Dastify Credentialing
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

## 5. Inngest (background jobs)

1. Create an Inngest app.
2. Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from their dashboard.
3. Locally: `npx inngest-cli dev` to run the dev server alongside `pnpm dev`.
4. In production: register the Vercel deployment URL `+ /api/inngest` with Inngest.

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

## 8. Deploy to Vercel

1. Push to GitHub, import into Vercel.
2. Add all env vars from `.env.local` to Vercel's environment.
3. Update Supabase Auth → URL Configuration with the Vercel URL.
4. Update `NEXT_PUBLIC_APP_URL` env var to the Vercel URL.
5. Register the Inngest sync URL.

### When a client requires HIPAA-grade infra

Upgrade plans + sign BAAs:
- Supabase: Pro + HIPAA add-on (~$599/mo)
- Vercel: Enterprise (BAA)
- Resend: Enterprise (BAA)
- Inngest: Enterprise (BAA)

The architecture already accommodates this — no code rework required.

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
