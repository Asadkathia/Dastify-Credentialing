/**
 * Migration runner.
 *
 * Applies every .sql file in db/migrations/ in lexical order. Tracks applied
 * migrations in a `_dastify_migrations` table so re-runs are idempotent.
 *
 * Usage:  pnpm db:migrate
 *
 * Requires: DATABASE_URL pointing at the Postgres instance, with privileges
 * sufficient to create extensions, enums, tables, and policies. For Supabase,
 * use the *direct* connection string (not the pooled one) so DDL works.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });

  await sql`
    CREATE TABLE IF NOT EXISTS _dastify_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set<string>(
    (await sql<{ filename: string }[]>`SELECT filename FROM _dastify_migrations`).map(
      (r) => r.filename,
    ),
  );

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (already applied)`);
      continue;
    }
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const contents = await readFile(fullPath, "utf8");
    process.stdout.write(`→ Applying ${file} ... `);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO _dastify_migrations (filename) VALUES (${file})`;
      });
      console.log("done");
      appliedCount++;
    } catch (err) {
      console.error("FAILED");
      console.error(err);
      await sql.end();
      process.exit(1);
    }
  }

  console.log(`\n${appliedCount} new migration(s) applied; ${applied.size + appliedCount} total.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
