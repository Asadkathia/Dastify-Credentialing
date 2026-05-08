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

## 4. Resend (email)

1. Create a domain at <https://resend.com>; add the DNS records.
2. Generate an API key → set `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` (e.g. `Dastify Credentialing <noreply@yourdomain.com>`).

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
