import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  FileText,
  Plus,
  Search,
  Stethoscope,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { RowOpenLink } from "@/components/ui/row-open-link";
import { ClientsFilterDrawer } from "./_components/clients-filter-drawer";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  has_enrollments?: string;
  state?: string;
}>;

type StatusFilter = "all" | "active" | "inactive";

function parseStatus(raw: string | undefined): StatusFilter {
  if (raw === "active" || raw === "inactive") return raw;
  return "all";
}

function buildHref(params: {
  status?: StatusFilter;
  q?: string;
  hasEnrollments?: boolean;
  state?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.hasEnrollments) sp.set("has_enrollments", "1");
  if (params.state) sp.set("state", params.state.toUpperCase());
  const qs = sp.toString();
  return qs ? `/admin/clients?${qs}` : "/admin/clients";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "—";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export default async function AdminClientsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);
  const qRaw = params.q?.trim() ?? "";
  const q = qRaw.length > 0 ? qRaw : "";
  const hasEnrollments = params.has_enrollments === "1";
  const stateFilter = (params.state ?? "").trim().toUpperCase();

  const supabase = await createSupabaseServerClient();

  // --- Stat strip queries (parallel, head-only counts) ---
  // For "Total Enrollments" and "Providers Linked" we count globally (admin sees
  // everything; RLS handles non-admin elsewhere).
  const [
    totalClientsRes,
    activeRes,
    inactiveRes,
    totalEnrollmentsRes,
    providersLinkedRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_active", false),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("providers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  const totalClients = totalClientsRes.count ?? 0;
  const activeClients = activeRes.count ?? 0;
  const inactiveClients = inactiveRes.count ?? 0;
  const totalEnrollments = totalEnrollmentsRes.count ?? 0;
  const providersLinked = providersLinkedRes.count ?? 0;

  // --- Optional pre-filtering for the drawer's "Has enrollments" / "State" ---
  // Both filter against the enrollments table. We pull a distinct list of
  // client_ids matching the criteria, then constrain the clients query with
  // `.in("id", ...)`. This is fine in v1 where the enrollment set is bounded.
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
    // If no enrollments matched, force empty result early to avoid building a
    // contradictory query.
    if (restrictToClientIds.length === 0) {
      restrictToClientIds = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  // --- Main clients query ---
  let query = supabase
    .from("clients")
    .select(
      "id, display_name, legal_name, primary_contact_name, primary_contact_email, primary_contact_phone, is_active, created_at",
    )
    .is("deleted_at", null);

  if (statusFilter === "active") query = query.eq("is_active", true);
  if (statusFilter === "inactive") query = query.eq("is_active", false);

  if (q) {
    // Escape % and , for PostgREST `or` clause syntax.
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

  // Per-client enrollment counts — single query, bucketed in JS to avoid N+1.
  const enrollmentCountsByClient = new Map<string, number>();
  if (clients && clients.length > 0) {
    const { data: enrolRows } = await supabase
      .from("enrollments")
      .select("client_id")
      .is("deleted_at", null)
      .in("client_id", clients.map((c) => c.id));
    for (const r of enrolRows ?? []) {
      if (!r.client_id) continue;
      enrollmentCountsByClient.set(
        r.client_id,
        (enrollmentCountsByClient.get(r.client_id) ?? 0) + 1,
      );
    }
  }

  const visibleCount = clients?.length ?? 0;
  const filtersActive =
    statusFilter !== "all" || q.length > 0 || hasEnrollments || stateFilter.length > 0;

  // Export URL preserves all current user-facing filters.
  const exportSp = new URLSearchParams();
  if (statusFilter !== "all") exportSp.set("status", statusFilter);
  if (q) exportSp.set("q", q);
  if (hasEnrollments) exportSp.set("has_enrollments", "1");
  if (stateFilter) exportSp.set("state", stateFilter);
  const exportHref = exportSp.toString()
    ? `/api/export/clients.csv?${exportSp.toString()}`
    : `/api/export/clients.csv`;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{totalClients}</span>{" "}
            {totalClients === 1 ? "practice" : "practices"} Dastify provides
            credentialing services to.
          </>
        }
        actions={
          <Button asChild className="uppercase tracking-[0.16em]">
            <Link href="/admin/clients/new">
              <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
              New Client
            </Link>
          </Button>
        }
      />

      {/* Stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="TOTAL CLIENTS"
          value={totalClients}
          icon={Building2}
          tone="teal"
        />
        <StatTile
          label="ACTIVE"
          value={activeClients}
          icon={CircleCheck}
          tone="green"
        />
        <StatTile
          label="TOTAL ENROLLMENTS"
          value={totalEnrollments}
          icon={FileText}
          tone="amber"
        />
        <StatTile
          label="PROVIDERS LINKED"
          value={providersLinked}
          icon={Stethoscope}
          tone="navy"
        />
      </div>

      {/* Filter tabs — pill switcher (design treatment) */}
      <div className="mb-4 inline-flex rounded-lg bg-lightgrey p-1">
        <FilterTab
          href={buildHref({
            status: "all",
            q,
            hasEnrollments,
            state: stateFilter,
          })}
          active={statusFilter === "all"}
          label="All"
          count={totalClients}
        />
        <FilterTab
          href={buildHref({
            status: "active",
            q,
            hasEnrollments,
            state: stateFilter,
          })}
          active={statusFilter === "active"}
          label="Active"
          count={activeClients}
        />
        <FilterTab
          href={buildHref({
            status: "inactive",
            q,
            hasEnrollments,
            state: stateFilter,
          })}
          active={statusFilter === "inactive"}
          label="Inactive"
          count={inactiveClients}
        />
      </div>

      {/* Toolbar: search + filter drawer + export */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form
          action="/admin/clients"
          method="get"
          className="relative w-full sm:max-w-sm"
        >
          {/* Persist current tab / drawer filters through the search submit. */}
          {statusFilter !== "all" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          {hasEnrollments ? <input type="hidden" name="has_enrollments" value="1" /> : null}
          {stateFilter ? <input type="hidden" name="state" value={stateFilter} /> : null}
          <Search
            size={14}
            strokeWidth={1.6}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/45"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search clients…"
            className="h-9 w-full rounded-md border border-border-subtle bg-white pl-8 pr-3 text-[13px] placeholder:text-navy/40 focus-visible:border-teal focus-visible:outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          <ClientsFilterDrawer
            status={statusFilter}
            q={q}
            hasEnrollments={hasEnrollments}
            state={stateFilter}
          />
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <a href={exportHref}>
              <Download size={14} strokeWidth={1.6} />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load clients: {error.message}
        </div>
      ) : null}

      {!error && visibleCount === 0 ? (
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.4} />}
          title={filtersActive ? "No clients match these filters" : "No clients yet"}
          description={
            filtersActive
              ? "Try widening the filters, clearing the search, or starting from All."
              : "Add the first practice Dastify provides credentialing services to. You can manage their providers, enrollments, and documents once they're set up."
          }
          action={
            filtersActive ? (
              <Button asChild variant="outline">
                <Link href="/admin/clients">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/clients/new">
                  <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                  New client
                </Link>
              </Button>
            )
          }
        />
      ) : null}

      {!error && visibleCount > 0 ? (
        <div className="surface">
          <div className="overflow-x-auto">
            <table className="data-table">
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>Legal name</th>
                  <th>Primary contact</th>
                  <th>Enrollments</th>
                  <th>Status</th>
                  <th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {clients!.map((c) => {
                  const enrollCount = enrollmentCountsByClient.get(c.id) ?? 0;
                  return (
                    <tr key={c.id}>
                      <td className="font-medium">
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="flex items-center gap-3 text-navy hover:text-teal"
                        >
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-teal-08 text-[13px] font-bold tracking-[0.02em] text-teal"
                          >
                            {initialsFromName(c.display_name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium leading-tight">
                              {c.display_name}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-navy/45">
                              # CLT-{shortId(c.id)}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-navy/60">{c.legal_name}</td>
                      <td className="text-navy/70">
                        {c.primary_contact_name || "—"}
                        {c.primary_contact_email ? (
                          <span className="block text-[11px] text-navy/45">
                            {c.primary_contact_email}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className="block text-[20px] font-bold leading-none tnum text-navy">
                          {enrollCount}
                        </span>
                        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-navy/45">
                          Active
                        </span>
                      </td>
                      <td>
                        <StatusDot active={c.is_active} />
                      </td>
                      <td className="text-right">
                        <RowOpenLink
                          href={`/admin/clients/${c.id}`}
                          ariaLabel={`Open ${c.display_name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer — single-page in v1, but rendered to match design. */}
          <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
            <p className="text-[12px] text-navy/55">
              Showing <span className="font-semibold text-navy tnum">{visibleCount}</span> of{" "}
              <span className="font-semibold text-navy tnum">
                {statusFilter === "all"
                  ? totalClients
                  : statusFilter === "active"
                    ? activeClients
                    : inactiveClients}
              </span>{" "}
              {visibleCount === 1 ? "client" : "clients"}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled
                aria-label="Previous page"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle text-navy/35 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} strokeWidth={1.7} />
              </button>
              <span
                aria-current="page"
                className="flex h-7 min-w-[28px] items-center justify-center rounded-md bg-navy px-2 text-[12px] font-semibold tnum text-white"
              >
                1
              </span>
              <button
                type="button"
                disabled
                aria-label="Next page"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle text-navy/35 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] uppercase tracking-[0.12em] transition-colors " +
        (active
          ? "bg-navy font-semibold text-white shadow-[var(--shadow-xs)]"
          : "font-semibold text-navy/55 hover:text-navy")
      }
    >
      {label}
      <span
        className={
          "tnum inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tracking-[0.04em] " +
          (active ? "bg-teal text-navy" : "bg-white text-navy/55")
        }
      >
        {count}
      </span>
    </Link>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " +
        (active ? "bg-success-08 text-[#1B5E20]" : "bg-navy-04 text-navy/55")
      }
    >
      <span
        aria-hidden
        className={
          "relative inline-flex h-1.5 w-1.5 rounded-full " +
          (active ? "bg-success" : "bg-navy/40")
        }
      >
        {active ? (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-success opacity-60"
          />
        ) : null}
      </span>
      {active ? "Active" : "Inactive"}
    </span>
  );
}
