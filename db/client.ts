import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Server-side Postgres client. RLS is bypassed when using the service-role connection,
// so this client should only be used for:
//   1. drizzle-kit migrations
//   2. server-side admin operations that explicitly need to bypass RLS (e.g., seeding)
//   3. background jobs (Inngest) that have their own authorization layer
//
// User-scoped queries from API routes / server actions should go through the Supabase
// client (which carries the user's JWT and triggers RLS), NOT this Drizzle client.
const queryClient = postgres(connectionString, {
  max: 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });
export { schema };
