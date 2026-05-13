import Link from "next/link";
import { UserCircle2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RowOpenLink } from "@/components/ui/row-open-link";

type SearchParams = Promise<{
  q?: string;
  specialty?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

export default async function PortalProvidersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOrganization();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const specialtyFilter = (params.specialty ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  // RLS scopes to caller's organization_id.
  let query = supabase
    .from("clients")
    .select(
      `id, first_name, middle_name, last_name, suffix, npi, primary_specialty,
       secondary_specialty, caqh_id`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q) {
    query = query.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,npi.ilike.%${q}%`,
    );
  }
  if (specialtyFilter) {
    query = query.ilike("primary_specialty", `%${specialtyFilter}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: providers, count, error } = await query
    .order("last_name")
    .range(from, to);

  // Active-enrollment counts per provider (small N — fine for v1).
  const ids = (providers ?? []).map((p) => p.id);
  let enrollmentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("client_id")
      .in("client_id", ids)
      .is("deleted_at", null)
      .not("status", "in", "(closed,withdrawn)");
    enrollmentCounts = (enrollments ?? []).reduce<Record<string, number>>((acc, e) => {
      if (e.client_id) acc[e.client_id] = (acc[e.client_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || specialtyFilter);

  return (
    <div>
      <PageHeader
        title="Providers"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total
            {hasFilters ? " (filtered)" : ""}
          </>
        }
      />

      <form
        action="/portal/clients"
        method="get"
        className="surface mb-6 flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or NPI…"
          className="h-8 w-[240px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        />
        <input
          type="text"
          name="specialty"
          defaultValue={specialtyFilter}
          placeholder="Specialty…"
          className="h-8 w-[160px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        />
        <button
          type="submit"
          className="h-8 rounded-sm bg-navy px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#161D52]"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/portal/clients"
            className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load providers: {error.message}
        </div>
      ) : (providers ?? []).length === 0 ? (
        <EmptyState
          icon={<UserCircle2 size={32} strokeWidth={1.4} />}
          title={hasFilters ? "No providers match these filters" : "No providers yet"}
          description={
            hasFilters
              ? "Try widening the filters, or clear them to see everything."
              : "Your providers will appear here once Dastify staff have added them."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="w-[140px]">NPI</th>
                  <th>Specialty</th>
                  <th className="w-[140px]">Active enrollments</th>
                  <th className="w-[60px] text-right" />
                </tr>
              </thead>
              <tbody>
                {providers!.map((p) => {
                  const display =
                    `${p.last_name}, ${p.first_name}` +
                    (p.middle_name ? ` ${p.middle_name[0]}.` : "") +
                    (p.suffix ? `, ${p.suffix}` : "");
                  const activeN = enrollmentCounts[p.id] ?? 0;
                  return (
                    <tr key={p.id}>
                      <td className="font-medium text-navy">{display}</td>
                      <td className="font-mono text-[12px] tnum text-navy/70">{p.npi ?? "—"}</td>
                      <td className="text-navy/70">
                        {p.primary_specialty || <span className="text-navy/45">—</span>}
                        {p.secondary_specialty ? (
                          <span className="block text-[11px] text-navy/45">
                            {p.secondary_specialty}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {activeN > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-sm bg-teal-08 px-2 py-0.5 text-[11px] font-semibold tnum text-navy">
                            {activeN}
                          </span>
                        ) : (
                          <span className="text-[11px] text-navy/45">0</span>
                        )}
                      </td>
                      <td className="text-right">
                        <RowOpenLink href={`/portal/clients/${p.id}`} label="View" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-[12px] text-navy/65">
              <p className="tnum">
                Showing <span className="font-semibold text-charcoal">{from + 1}</span>–
                <span className="font-semibold text-charcoal">{Math.min(to + 1, total)}</span> of{" "}
                <span className="font-semibold text-charcoal">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={buildHref({ q, specialty: specialtyFilter, page: String(page - 1) })}
                    className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
                  >
                    ← Prev
                  </Link>
                ) : null}
                <span className="tnum px-1">
                  Page {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={buildHref({ q, specialty: specialtyFilter, page: String(page + 1) })}
                    className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function buildHref(params: { q?: string; specialty?: string; page?: string }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.specialty) sp.set("specialty", params.specialty);
  if (params.page) sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/portal/clients?${qs}` : "/portal/clients";
}
