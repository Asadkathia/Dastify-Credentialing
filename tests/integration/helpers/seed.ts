import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { adminClient } from "./clients";

/**
 * Two-tenant fixture used by every RLS test.
 *
 * Builds (via service-role, RLS-bypassed) a clean world consisting of:
 *   - 2 organizations: orgA, orgB
 *   - 1 platform admin
 *   - per org: 1 org_admin, 1 org_viewer
 *   - per org: 2 clinicians, 2 enrollments (one per clinician × shared payer)
 *   - per org: 1 public document, 1 internal document, 1 internal note, 1 comment
 *   - 1 shared payer, 1 shared document_category
 *
 * Each user is signed in once and the resulting access token is attached to
 * the returned `Seeded` so tests can build per-user clients with
 * `userClient(seeded.orgA.adminUser.token)`.
 *
 * Tests should call `seedFixture()` once in `beforeAll`.
 */

type Role = "platform_admin" | "org_admin" | "org_viewer";

const PASSWORD = "test-password-1234!";
const TEST_EMAIL_DOMAIN = "rls.test";

export type SeededUser = {
  id: string;
  email: string;
  token: string;
};

export type Seeded = {
  platformAdmin: SeededUser;
  payerId: string;
  categoryId: string;
  orgA: SeededOrg;
  orgB: SeededOrg;
};

export type SeededOrg = {
  id: string;
  adminUser: SeededUser;
  viewerUser: SeededUser;
  clinicianIds: [string, string];
  enrollmentIds: [string, string];
  publicDocId: string;
  internalDocId: string;
  internalNoteId: string;
  commentId: string;
};

export async function seedFixture(): Promise<Seeded> {
  await resetDatabase();
  const admin = adminClient();

  const platformAdmin = await provisionUser(admin, "platform-admin", "platform_admin", null);

  const { data: payer, error: payerErr } = await admin
    .from("payers")
    .insert({
      name: "Test Payer",
      payer_type: "commercial",
      states_active: ["NY", "CA"],
    })
    .select("id")
    .single();
  if (payerErr || !payer) throw new Error(`seed payer: ${payerErr?.message}`);

  const { data: category, error: catErr } = await admin
    .from("document_categories")
    .insert({
      name: "rls_test_cat",
      label: "RLS Test Category",
      sort_order: 1,
      is_default: false,
    })
    .select("id")
    .single();
  if (catErr || !category) throw new Error(`seed category: ${catErr?.message}`);

  const orgA = await seedOrg(admin, "alpha", payer.id, category.id);
  const orgB = await seedOrg(admin, "bravo", payer.id, category.id);

  return {
    platformAdmin,
    payerId: payer.id,
    categoryId: category.id,
    orgA,
    orgB,
  };
}

async function seedOrg(
  admin: SupabaseClient,
  slug: string,
  payerId: string,
  categoryId: string,
): Promise<SeededOrg> {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      legal_name: `Org ${slug} LLC`,
      display_name: `Org ${slug}`,
      kind: "group",
    })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`seed org ${slug}: ${orgErr?.message}`);

  await admin
    .from("organization_settings")
    .insert({ organization_id: org.id })
    .throwOnError();

  const adminUser = await provisionUser(admin, `${slug}-admin`, "org_admin", org.id);
  const viewerUser = await provisionUser(admin, `${slug}-viewer`, "org_viewer", org.id);

  const { data: clinData, error: clinErr } = await admin
    .from("clients")
    .insert([
      { organization_id: org.id, first_name: "Alice", last_name: `${slug}-1` },
      { organization_id: org.id, first_name: "Bob", last_name: `${slug}-2` },
    ])
    .select("id");
  const [clin0, clin1] = clinData ?? [];
  if (clinErr || !clin0 || !clin1)
    throw new Error(`seed clinicians ${slug}: ${clinErr?.message}`);

  const { data: enrData, error: enrErr } = await admin
    .from("enrollments")
    .insert([
      {
        organization_id: org.id,
        client_id: clin0.id,
        payer_id: payerId,
        state: "NY",
      },
      {
        organization_id: org.id,
        client_id: clin1.id,
        payer_id: payerId,
        state: "NY",
      },
    ])
    .select("id");
  const [enr0, enr1] = enrData ?? [];
  if (enrErr || !enr0 || !enr1)
    throw new Error(`seed enrollments ${slug}: ${enrErr?.message}`);

  const { data: docData, error: docErr } = await admin
    .from("documents")
    .insert([
      {
        organization_id: org.id,
        owner_type: "enrollment",
        owner_id: enr0.id,
        category_id: categoryId,
        file_name: `${slug}-public.pdf`,
        storage_path: `${org.id}/${slug}-public.pdf`,
        mime_type: "application/pdf",
        size_bytes: 1024,
        is_internal: false,
        uploaded_by_user_id: adminUser.id,
      },
      {
        organization_id: org.id,
        owner_type: "enrollment",
        owner_id: enr0.id,
        category_id: categoryId,
        file_name: `${slug}-internal.pdf`,
        storage_path: `${org.id}/${slug}-internal.pdf`,
        mime_type: "application/pdf",
        size_bytes: 2048,
        is_internal: true,
        uploaded_by_user_id: adminUser.id,
      },
    ])
    .select("id");
  const [doc0, doc1] = docData ?? [];
  if (docErr || !doc0 || !doc1)
    throw new Error(`seed docs ${slug}: ${docErr?.message}`);

  const { data: note, error: noteErr } = await admin
    .from("internal_notes")
    .insert({
      organization_id: org.id,
      enrollment_id: enr0.id,
      author_user_id: adminUser.id,
      body: `${slug} internal note`,
    })
    .select("id")
    .single();
  if (noteErr || !note) throw new Error(`seed note ${slug}: ${noteErr?.message}`);

  const { data: comment, error: commentErr } = await admin
    .from("comments")
    .insert({
      organization_id: org.id,
      enrollment_id: enr0.id,
      author_user_id: adminUser.id,
      body: `${slug} org comment`,
    })
    .select("id")
    .single();
  if (commentErr || !comment)
    throw new Error(`seed comment ${slug}: ${commentErr?.message}`);

  return {
    id: org.id,
    adminUser,
    viewerUser,
    clinicianIds: [clin0.id, clin1.id],
    enrollmentIds: [enr0.id, enr1.id],
    publicDocId: doc0.id,
    internalDocId: doc1.id,
    internalNoteId: note.id,
    commentId: comment.id,
  };
}

async function provisionUser(
  admin: SupabaseClient,
  slug: string,
  role: Role,
  organizationId: string | null,
): Promise<SeededUser> {
  const email = `${slug}-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user)
    throw new Error(`create auth user ${slug}: ${createErr?.message}`);

  const id = created.user.id;

  if (role === "platform_admin") {
    await admin
      .from("admin_users")
      .insert({
        id,
        email,
        full_name: `Platform Admin ${slug}`,
      })
      .throwOnError();
  } else {
    if (!organizationId)
      throw new Error(`org user ${slug} needs organizationId`);
    await admin
      .from("organization_users")
      .insert({
        id,
        organization_id: organizationId,
        email,
        full_name: `${role} ${slug}`,
        role,
        accepted_at: new Date().toISOString(),
      })
      .throwOnError();
  }

  const signInClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: session, error: signInErr } =
    await signInClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr || !session.session)
    throw new Error(`sign in ${slug}: ${signInErr?.message}`);

  return { id, email, token: session.session.access_token };
}

/**
 * Truncate every tenant table + global lookup table, and delete every test
 * auth user. Migrations stay applied so the next seed boots fast.
 *
 * Runs raw SQL directly via the postgres driver (not PostgREST) because
 * TRUNCATE is not exposed through the REST API and we don't want a permanent
 * SECURITY DEFINER wrapper polluting production-shaped schemas.
 */
export async function resetDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set; global-setup did not run.");

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    await sql.unsafe(`
      TRUNCATE TABLE
        public.activity_events,
        public.status_history,
        public.internal_notes,
        public.comments,
        public.documents,
        public.enrollments,
        public.clients,
        public.organization_users,
        public.organization_settings,
        public.organizations,
        public.document_categories,
        public.payers,
        public.admin_users
      RESTART IDENTITY CASCADE;
    `);
  } finally {
    await sql.end();
  }

  const admin = adminClient();
  const { data: users, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (listErr) throw new Error(`list users: ${listErr.message}`);
  for (const u of users.users) {
    if (u.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}
