import Link from "next/link";
import { format } from "date-fns";
import { ClipboardList, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { RowOpenLink } from "@/components/ui/row-open-link";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";

type SearchParams = Promise<{
  status?: string | string[];
  payer?: string;
  state?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter = parseStatusFilter(params.status);
  const payerFilter = params.payer?.trim() ?? "";
  const stateFilter = params.state?.trim().toUpperCase() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  // Build base query — admin sees all clients (no RLS filter; RLS uses role).
  let query = supabase
    .from("enrollments")
    .select(
      `id, state, status, sub_status, effective_date, updated_at,
       client:organization_id (id, display_name),
       provider:client_id (id, first_name, last_name),
       payer:payer_id (id, name)`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }
  if (stateFilter) {
    query = query.eq("state", stateFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: enrollments, count, error } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  // Payer filter is post-query because the join is non-trivial — could be moved
  // server-side with a join filter but the dataset stays small in v1.
  let rows = enrollments ?? [];
  if (payerFilter) {
    const needle = payerFilter.toLowerCase();
    rows = rows.filter((r) => {
      const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
      return payer?.name?.toLowerCase().includes(needle);
    });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Statuses to render as filter chips — render in pipeline order.
  const statusChips = ENROLLMENT_STATUSES;

  return (
    <div>
      <PageHeader
        title="Enrollments"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total across all
            clients
            {statusFilter.length || stateFilter || payerFilter ? " (filtered)" : ""}
          </>
        }
      />

      {/* Filter bar */}
      <div className="surface mb-6 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter chips — each toggles via URL */}
          <FilterChip
            label="All"
            href={buildHref({ ...params, status: undefined, page: undefined })}
            active={statusFilter.length === 0}
          />
          {statusChips.map((s) => {
            const isOn = statusFilter.includes(s);
            const nextStatus = isOn
              ? statusFilter.filter((x) => x !== s)
              : [...statusFilter, s];
            return (
              <FilterChip
                key={s}
                label={STATUS_LABELS[s]}
                href={buildHref({
                  ...params,
                  status: nextStatus.length === 0 ? undefined : nextStatus,
                  page: undefined,
                })}
                active={isOn}
                tone={isOn ? statusTone(s) : "neutral"}
              />
            );
          })}

          <span className="mx-2 hidden h-5 w-px bg-border-subtle md:inline-block" />

          {/* Payer + State search via GET form */}
          <form action="/admin/enrollments" method="get" className="flex items-center gap-2">
            {/* Persist current status filter through search */}
            {statusFilter.map((s) => (
              <input key={s} type="hidden" name="status" value={s} />
            ))}
            <input
              type="text"
              name="payer"
              defaultValue={payerFilter}
              placeholder="Payer name…"
              className="h-8 w-[160px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
            />
            <input
              type="text"
              name="state"
              defaultValue={stateFilter}
              maxLength={2}
              placeholder="TX"
              className="h-8 w-[60px] rounded-sm border border-border-subtle bg-white px-2.5 font-mono text-[12px] uppercase focus-visible:border-teal focus-visible:outline-none"
            />
            <button
              type="submit"
              className="h-8 rounded-sm bg-navy px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#161D52]"
            >
              Apply
            </button>
            {(payerFilter || stateFilter) && (
              <Link
                href={buildHref({
                  status: statusFilter.length === 0 ? undefined : statusFilter,
                })}
                className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
              >
                Clear
              </Link>
            )}
          </form>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load enrollments: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={32} strokeWidth={1.4} />}
          title={
            statusFilter.length || stateFilter || payerFilter
              ? "No enrollments match these filters"
              : "No enrollments yet"
          }
          description={
            statusFilter.length || stateFilter || payerFilter
              ? "Try widening the filters, or clear them to see everything."
              : "Open a client and create the first enrollment to see it here."
          }
          action={
            <Button asChild variant="outline">
              <Link href="/admin/organizations">
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                Open Clients
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Subject</th>
                  <th>Payer</th>
                  <th className="w-[60px]">State</th>
                  <th>Status</th>
                  <th>Effective</th>
                  <th className="w-[110px]">Updated</th>
                  <th className="w-[60px] text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const client = Array.isArray(e.client) ? e.client[0] : e.client;
                  const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                  const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                  const subject = provider
                    ? `${provider.last_name}, ${provider.first_name}`
                    : "—";
                  const status = e.status as EnrollmentStatus;
                  const detailHref = client
                    ? `/admin/organizations/${client.id}/enrollments/${e.id}`
                    : "#";

                  return (
                    <tr key={e.id}>
                      <td>
                        {client ? (
                          <Link
                            href={`/admin/organizations/${client.id}`}
                            className="text-[13px] font-medium text-navy hover:text-teal"
                          >
                            {client.display_name}
                          </Link>
                        ) : (
                          <span className="text-navy/45">—</span>
                        )}
                      </td>
                      <td className="text-navy/85">{subject}</td>
                      <td className="text-navy/70">{payer?.name ?? "—"}</td>
                      <td className="font-mono text-[12px] tnum text-navy/70">{e.state}</td>
                      <td>
                        <StatusChip status={status} />
                        {e.sub_status ? (
                          <p className="mt-1 text-[11px] text-navy/55">{e.sub_status}</p>
                        ) : null}
                      </td>
                      <td className="tnum text-[12px] text-navy/70">
                        {e.effective_date ? format(new Date(e.effective_date), "PP") : "—"}
                      </td>
                      <td className="tnum text-[11px] text-navy/55">
                        {format(new Date(e.updated_at), "PP")}
                      </td>
                      <td className="text-right">
                        <RowOpenLink href={detailHref} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
                    href={buildHref({ ...params, page: String(page - 1) })}
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
                    href={buildHref({ ...params, page: String(page + 1) })}
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
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  tone = "neutral",
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: "neutral" | "blue" | "teal" | "yellow" | "green" | "amber" | "danger" | "grey";
}) {
  const activeClass: Record<NonNullable<typeof tone>, string> = {
    neutral: "border-navy bg-navy text-white",
    blue: "border-[#1565C0] bg-[#1565C0]/10 text-[#1565C0]",
    teal: "border-teal bg-teal-08 text-teal",
    yellow: "border-[#EAB308] bg-[#EAB308]/12 text-[#854D0E]",
    green: "border-success bg-success-08 text-[#1B5E20]",
    amber: "border-warning bg-warning-08 text-[#7a4f00]",
    danger: "border-danger bg-danger-08 text-danger",
    grey: "border-grey bg-lightgrey text-navy/65",
  };
  return (
    <Link
      href={href}
      data-active={active}
      className={
        "inline-flex h-8 items-center rounded-sm border px-3 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors " +
        (active
          ? activeClass[tone]
          : "border-border-subtle bg-white text-navy/65 hover:border-grey hover:bg-lightgrey")
      }
    >
      {label}
    </Link>
  );
}

function statusTone(s: EnrollmentStatus): "blue" | "teal" | "yellow" | "green" | "amber" {
  return STATUS_COLORS[s].toneName;
}

function parseStatusFilter(raw: string | string[] | undefined): EnrollmentStatus[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter((s): s is EnrollmentStatus =>
    (ENROLLMENT_STATUSES as readonly string[]).includes(s),
  );
}

function buildHref(params: {
  status?: string | string[];
  payer?: string;
  state?: string;
  page?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.status) {
    const arr = Array.isArray(params.status) ? params.status : [params.status];
    arr.forEach((s) => sp.append("status", s));
  }
  if (params.payer) sp.set("payer", params.payer);
  if (params.state) sp.set("state", params.state);
  if (params.page) sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/admin/enrollments?${qs}` : "/admin/enrollments";
}
