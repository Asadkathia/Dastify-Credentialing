import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Streams a .csv of the admin clients list, honoring the same user-facing
 * filters as `/admin/clients` (status tab, search, has_enrollments, state).
 * Columns: Display Name, Legal Name, Primary Contact Name, Primary Contact
 * Email, Primary Contact Phone, Active, Enrollments (count), Created At.
 */
export async function GET(request: Request) {
  const session = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status");
  const statusFilter: "all" | "active" | "inactive" =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  const q = (searchParams.get("q") ?? "").trim();
  const hasEnrollments = searchParams.get("has_enrollments") === "1";
  const stateFilter = (searchParams.get("state") ?? "").trim().toUpperCase();

  // Build the optional id-restriction set from the drawer's enrollment filters.
  let restrictToClientIds: string[] | null = null;
  if (hasEnrollments || stateFilter) {
    let eq = supabase
      .from("enrollments")
      .select("client_id")
      .is("deleted_at", null);
    if (stateFilter) eq = eq.eq("state", stateFilter);
    const { data: enrolRows } = await eq;
    const ids = new Set<string>();
    for (const r of enrolRows ?? []) {
      if (r.client_id) ids.add(r.client_id);
    }
    restrictToClientIds = Array.from(ids);
    if (restrictToClientIds.length === 0) {
      restrictToClientIds = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  let query = supabase
    .from("clients")
    .select(
      "id, display_name, legal_name, primary_contact_name, primary_contact_email, primary_contact_phone, is_active, created_at",
    )
    .is("deleted_at", null);

  if (statusFilter === "active") query = query.eq("is_active", true);
  if (statusFilter === "inactive") query = query.eq("is_active", false);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(
      `display_name.ilike.%${safe}%,legal_name.ilike.%${safe}%,primary_contact_email.ilike.%${safe}%`,
    );
  }
  if (restrictToClientIds) {
    query = query.in("id", restrictToClientIds);
  }

  const { data: clients, error } = await query.order("display_name", {
    ascending: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count active enrollments per client in one round-trip — keep it simple in
  // v1; the dataset stays small. We aggregate client-side from a wide select
  // because PostgREST `group by` is awkward through the JS client.
  const clientIds = (clients ?? []).map((c) => c.id);
  const enrollmentsByClient = new Map<string, number>();
  if (clientIds.length > 0) {
    const { data: enrolRows } = await supabase
      .from("enrollments")
      .select("client_id")
      .in("client_id", clientIds)
      .is("deleted_at", null);
    for (const r of enrolRows ?? []) {
      if (!r.client_id) continue;
      enrollmentsByClient.set(r.client_id, (enrollmentsByClient.get(r.client_id) ?? 0) + 1);
    }
  }

  const headers = [
    "Display Name",
    "Legal Name",
    "Primary Contact Name",
    "Primary Contact Email",
    "Primary Contact Phone",
    "Active",
    "Enrollments",
    "Created At",
  ];
  const lines: string[] = [headers.map(csvEscape).join(",")];
  for (const c of clients ?? []) {
    lines.push(
      [
        c.display_name ?? "",
        c.legal_name ?? "",
        c.primary_contact_name ?? "",
        c.primary_contact_email ?? "",
        c.primary_contact_phone ?? "",
        c.is_active ? "Yes" : "No",
        String(enrollmentsByClient.get(c.id) ?? 0),
        c.created_at ? new Date(c.created_at).toISOString() : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  // RFC 4180: CRLF + final CRLF.
  const body = lines.join("\r\n") + "\r\n";

  // Append-only audit row. Note: `client_id` is nullable on activity_events for
  // global / cross-client admin events like this list export.
  await supabase.from("activity_events").insert({
    actor_user_id: session.userId,
    action: "export",
    target_table: "clients",
    summary: `Exported ${clients?.length ?? 0} clients to .csv`,
  });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `dastify-clients-${today}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      // text/csv per RFC 4180; charset declared so Excel imports UTF-8 cleanly.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * RFC 4180 field escape. Wraps the value in double-quotes when it contains a
 * delimiter, quote, or newline, and doubles internal quotes.
 */
function csvEscape(value: string): string {
  if (value === undefined || value === null) return "";
  const needs = /[",\r\n]/.test(value);
  if (!needs) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
