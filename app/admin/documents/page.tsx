import Link from "next/link";
import { format, differenceInCalendarDays } from "date-fns";
import { FileText, Lock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type SearchParams = Promise<{
  category?: string;
  exp?: string;
  q?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

const EXPIRATION_TONE = {
  expired: { bg: "bg-danger-08", text: "text-danger", label: "Expired" },
  soon: { bg: "bg-warning-08", text: "text-[#7a4f00]", label: "Expiring soon" },
  ok: { bg: "bg-success-08", text: "text-[#1B5E20]", label: "Active" },
  none: { bg: "bg-lightgrey", text: "text-navy/55", label: "No expiry" },
} as const;

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const categoryFilter = (params.category ?? "").trim();
  const expFilter = (params.exp ?? "").trim();
  const q = (params.q ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("documents")
    .select(
      `id, file_name, owner_type, owner_id, size_bytes, mime_type, expiration_date, is_internal,
       virus_scan_status, created_at, client_id,
       category:category_id (id, name, label),
       client:client_id (id, display_name)`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (categoryFilter) {
    query = query.eq("category_id", categoryFilter);
  }
  if (q) {
    query = query.ilike("file_name", `%${q}%`);
  }
  if (expFilter === "expired") {
    const today = new Date().toISOString().split("T")[0];
    query = query.lt("expiration_date", today!);
  } else if (expFilter === "soon") {
    const today = new Date().toISOString().split("T")[0];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 60);
    const cutoffIso = cutoff.toISOString().split("T")[0];
    query = query.gte("expiration_date", today!).lte("expiration_date", cutoffIso!);
  } else if (expFilter === "none") {
    query = query.is("expiration_date", null);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: documents, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data: categories } = await supabase
    .from("document_categories")
    .select("id, name, label")
    .order("sort_order");

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(categoryFilter || expFilter || q);

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total across all
            clients
            {hasFilters ? " (filtered)" : ""}
          </>
        }
      />

      {/* Filter bar */}
      <div className="surface mb-6 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterLink
            label="All"
            href={buildHref({ category: categoryFilter, q })}
            active={!expFilter}
          />
          <FilterLink
            label="Expiring soon"
            href={buildHref({ category: categoryFilter, q, exp: "soon" })}
            active={expFilter === "soon"}
            tone="amber"
          />
          <FilterLink
            label="Expired"
            href={buildHref({ category: categoryFilter, q, exp: "expired" })}
            active={expFilter === "expired"}
            tone="danger"
          />
          <FilterLink
            label="No expiry"
            href={buildHref({ category: categoryFilter, q, exp: "none" })}
            active={expFilter === "none"}
            tone="grey"
          />

          <span className="mx-2 hidden h-5 w-px bg-border-subtle md:inline-block" />

          <form action="/admin/documents" method="get" className="flex items-center gap-2">
            {expFilter ? <input type="hidden" name="exp" value={expFilter} /> : null}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Filename…"
              className="h-8 w-[200px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
            />
            <select
              name="category"
              defaultValue={categoryFilter}
              className="h-8 rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
            >
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-8 rounded-sm bg-navy px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#161D52]"
            >
              Apply
            </button>
            {hasFilters ? (
              <Link
                href="/admin/documents"
                className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load documents: {error.message}
        </div>
      ) : (documents ?? []).length === 0 ? (
        <EmptyState
          icon={<FileText size={32} strokeWidth={1.4} />}
          title={hasFilters ? "No documents match these filters" : "No documents yet"}
          description={
            hasFilters
              ? "Try widening the filters, or clear them to see everything."
              : "Documents uploaded to any provider, enrollment, or group will appear here."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Client</th>
                  <th className="w-[140px]">Category</th>
                  <th className="w-[100px]">Owner</th>
                  <th>Expires</th>
                  <th className="w-[100px]">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {documents!.map((d) => {
                  const cat = Array.isArray(d.category) ? d.category[0] : d.category;
                  const client = Array.isArray(d.client) ? d.client[0] : d.client;
                  const expTone = expirationTone(d.expiration_date);
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-start gap-2">
                          <FileText
                            size={14}
                            strokeWidth={1.6}
                            className="mt-0.5 shrink-0 text-teal"
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy">{d.file_name}</p>
                            <p className="text-[11px] text-navy/55 tnum">
                              {formatBytes(d.size_bytes)}
                            </p>
                          </div>
                          {d.is_internal ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-warning-08 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7a4f00]"
                              title="Internal-only — never shown to clients"
                            >
                              <Lock size={9} strokeWidth={1.6} />
                              Internal
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {client ? (
                          <Link
                            href={`/admin/clients/${client.id}`}
                            className="text-[13px] text-navy/85 hover:text-teal"
                          >
                            {client.display_name}
                          </Link>
                        ) : (
                          <span className="text-navy/45">—</span>
                        )}
                      </td>
                      <td>
                        {cat ? (
                          <span className="inline-flex items-center rounded-sm bg-lightgrey px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-navy/70">
                            {cat.label}
                          </span>
                        ) : (
                          <span className="text-navy/45">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65">
                          {d.owner_type}
                        </span>
                      </td>
                      <td>
                        {d.expiration_date ? (
                          <span
                            className={
                              "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-semibold tnum " +
                              expTone.bg +
                              " " +
                              expTone.text
                            }
                          >
                            {format(new Date(d.expiration_date), "PP")}
                          </span>
                        ) : (
                          <span className="text-[11px] text-navy/45">—</span>
                        )}
                      </td>
                      <td className="tnum text-[11px] text-navy/55">
                        {format(new Date(d.created_at), "PP")}
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
                    href={buildHref({ category: categoryFilter, exp: expFilter, q, page: String(page - 1) })}
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
                    href={buildHref({ category: categoryFilter, exp: expFilter, q, page: String(page + 1) })}
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

function FilterLink({
  label,
  href,
  active,
  tone = "neutral",
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: "neutral" | "amber" | "danger" | "grey";
}) {
  const activeClass = {
    neutral: "border-navy bg-navy text-white",
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

function expirationTone(date: string | null): (typeof EXPIRATION_TONE)[keyof typeof EXPIRATION_TONE] {
  if (!date) return EXPIRATION_TONE.none;
  const days = differenceInCalendarDays(new Date(date), new Date());
  if (days < 0) return EXPIRATION_TONE.expired;
  if (days <= 60) return EXPIRATION_TONE.soon;
  return EXPIRATION_TONE.ok;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function buildHref(params: { category?: string; exp?: string; q?: string; page?: string }): string {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.exp) sp.set("exp", params.exp);
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/admin/documents?${qs}` : "/admin/documents";
}
