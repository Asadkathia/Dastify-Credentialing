/**
 * Seed runner. Currently seeds the global payer master list.
 *
 * Usage: pnpm db:seed
 *
 * Idempotent: uses ON CONFLICT DO NOTHING on payer name.
 */
import postgres from "postgres";
import { payers as payerSeed } from "./payers";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false });

  console.log(`→ Seeding ${payerSeed.length} payers...`);

  // Add a unique constraint on name if it doesn't exist (idempotent seed needs this).
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payers_name_unique'
      ) THEN
        ALTER TABLE payers ADD CONSTRAINT payers_name_unique UNIQUE (name);
      END IF;
    END$$;
  `);

  for (const p of payerSeed) {
    await sql`
      INSERT INTO payers (name, payer_type, states_active)
      VALUES (
        ${p.name},
        ${p.payerType}::payer_type,
        ${JSON.stringify(p.statesActive)}::jsonb
      )
      ON CONFLICT (name) DO NOTHING
    `;
  }

  console.log("✓ Payer seed complete");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
