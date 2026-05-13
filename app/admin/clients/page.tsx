import Link from "next/link";
import { UserCircle2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RowOpenLink } from "@/components/ui/row-open-link";

type SearchParams = Promise<{
  q?: string;
  organization?: string;
  specialty?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const orgFilter = (params.organization ?? "").trim();
  const specialtyFilter = (params.specialty ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("clients")
    .select(
      `id, organization_id, first_name, middle_name, last_name, suffix, npi, primary_specialty,
       secondary_specialty, caqh_id,
       organization:organization_id (id, display_name)`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q) {
    query = query.or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,npi.ilike.%${q}%`);
  }
  if (specialtyFilter) {
    query = query.ilike("primary_specialty", `%${specialtyFilter}%`);
  }
  if (orgFilter) {
    query = query.eq("organization_id", orgFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: clients, count, error } = await query.order("last_name").range(from, to);

  // Enrollment counts per client (clinician). Counts all non-soft-deleted rows;
  // a row in any of the 5 enrollment statuses contributes.
  const ids = (clients ?? []).map((c) => c.id);
  let enrollmentCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("client_id")
      .in("client_id", ids)
      .is("deleted_at", null);
    enrollmentCounts = (enrollments ?? []).reduce<Record<string, number>>((acc, e) => {
      if (e.client_id) acc[e.client_id] = (acc[e.client_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  // Organization filter dropdown options.
  const { data: orgList } = await supabase
    .from("organizations")
    .select("id, display_name")
    .is("deleted_at", null)
    .order("display_name");

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || orgFilter || specialtyFilter);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total across all
            organizations
            {hasFilters ? " (filtered)" : ""}
          </>
        }
      />

      <form
        action="/admin/clients"
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
        <select
          name="organization"
          defaultValue={orgFilter}
          className="h-8 rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        >
          <option value="">All organizations</option>
          {(orgList ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.display_name}
            </option>
          ))}
        </select>
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
            href="/admin/clients"
            className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load clients: {error.message}
        </div>
      ) : (clients ?? []).length === 0 ? (
        <EmptyState
          icon={<UserCircle2 size={32} strokeWidth={1.4} />}
          title={hasFilters ? "No clients match these filters" : "No clients yet"}
          description={
            hasFilters
              ? "Try widening the filters, or clear them to see everything."
              : "Clients are added per-organization. Open an organization and add a client to see them here."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th className="w-[140px]">NPI</th>
                  <th>Specialty</th>
                  <th className="w-[140px]">Enrollments</th>
                  <th className="w-[60px] text-right" />
                </tr>
              </thead>
              <tbody>
                {clients!.map((c) => {
                  const org = Array.isArray(c.organization) ? c.organization[0] : c.organization;
                  const display =
                    `${c.last_name}, ${c.first_name}` +
                    (c.middle_name ? ` ${c.middle_name[0]}.` : "") +
                    (c.suffix ? `, ${c.suffix}` : "");
                  const enrollN = enrollmentCounts[c.id] ?? 0;
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-navy">{display}</td>
                      <td>
                        {org ? (
                          <Link
                            href={`/admin/organizations/${org.id}`}
                            className="text-navy/85 hover:text-teal"
                          >
                            {org.display_name}
                          </Link>
                        ) : (
                          <span className="text-navy/45">—</span>
                        )}
                      </td>
                      <td className="font-mono text-[12px] tnum text-navy/70">{c.npi ?? "—"}</td>
                      <td className="text-navy/70">
                        {c.primary_specialty || <span className="text-navy/45">—</span>}
                        {c.secondary_specialty ? (
                          <span className="block text-[11px] text-navy/45">
                            {c.secondary_specialty}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {enrollN > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-sm bg-teal-08 px-2 py-0.5 text-[11px] font-semibold tnum text-navy">
                            {enrollN}
                          </span>
                        ) : (
                          <span className="text-[11px] text-navy/45">0</span>
                        )}
                      </td>
                      <td className="text-right">
                        {org ? (
                          <RowOpenLink href={`/admin/organizations/${org.id}/clients/${c.id}`} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              from={from + 1}
              to={Math.min(to + 1, total)}
              total={total}
              hrefFor={(p) =>
                `/admin/clients?${buildQs({
                  q,
                  organization: orgFilter,
                  specialty: specialtyFilter,
                  page: String(p),
                })}`
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function buildQs(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, v);
  });
  return sp.toString();
}

function Pagination({
  page,
  totalPages,
  from,
  to,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-[12px] text-navy/65">
      <p className="tnum">
        Showing <span className="font-semibold text-charcoal">{from}</span>–
        <span className="font-semibold text-charcoal">{to}</span> of{" "}
        <span className="font-semibold text-charcoal">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
          >
            ← Prev
          </Link>
        ) : (
          <span className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/30">
            ← Prev
          </span>
        )}
        <span className="tnum px-1">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/30">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
