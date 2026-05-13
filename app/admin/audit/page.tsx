import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type SearchParams = Promise<{
  action?: string;
  target?: string;
  page?: string;
}>;

const PAGE_SIZE = 100;

const ACTION_TONE: Record<string, { bg: string; text: string; label: string }> = {
  create: { bg: "bg-success-08", text: "text-[#1B5E20]", label: "Create" },
  update: { bg: "bg-teal-08", text: "text-navy", label: "Update" },
  delete: { bg: "bg-danger-08", text: "text-danger", label: "Delete" },
  soft_delete: { bg: "bg-warning-08", text: "text-[#7a4f00]", label: "Soft delete" },
  restore: { bg: "bg-success-08", text: "text-[#1B5E20]", label: "Restore" },
  status_change: { bg: "bg-teal-08", text: "text-navy", label: "Status change" },
  comment_post: { bg: "bg-teal-08", text: "text-navy", label: "Comment" },
  internal_note_post: { bg: "bg-warning-08", text: "text-[#7a4f00]", label: "Internal note" },
  document_upload: { bg: "bg-teal-08", text: "text-navy", label: "Doc upload" },
  document_delete: { bg: "bg-danger-08", text: "text-danger", label: "Doc delete" },
  user_invite: { bg: "bg-teal-08", text: "text-navy", label: "User invite" },
  user_login: { bg: "bg-lightgrey", text: "text-navy/65", label: "Login" },
  export: { bg: "bg-teal-08", text: "text-navy", label: "Export" },
};

const ACTION_OPTIONS = [
  "",
  "create",
  "update",
  "delete",
  "status_change",
  "comment_post",
  "internal_note_post",
  "document_upload",
  "document_delete",
  "user_invite",
  "user_login",
  "export",
];

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actionFilter = (params.action ?? "").trim();
  const targetFilter = (params.target ?? "").trim();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("activity_events")
    .select(
      `id, organization_id, actor_user_id, action, target_table, target_id, summary, occurred_at,
       client:organization_id (id, display_name)`,
      { count: "exact" },
    );

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }
  if (targetFilter) {
    query = query.eq("target_table", targetFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: events, count, error } = await query
    .order("occurred_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(actionFilter || targetFilter);

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle={
          <>
            Append-only event stream from{" "}
            <code className="rounded-sm bg-lightgrey px-1.5 py-0.5 font-mono text-[11px] text-navy/85">
              activity_events
            </code>
            . <span className="tnum font-semibold text-charcoal">{total}</span> events
            {hasFilters ? " (filtered)" : ""}.
          </>
        }
      />

      <form
        action="/admin/audit"
        method="get"
        className="surface mb-6 flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <select
          name="action"
          defaultValue={actionFilter}
          className="h-8 rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.slice(1).map((a) => (
            <option key={a} value={a}>
              {ACTION_TONE[a]?.label ?? a}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="target"
          defaultValue={targetFilter}
          placeholder="Target table (e.g. enrollments)…"
          className="h-8 w-[220px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        />
        <button
          type="submit"
          className="h-8 rounded-sm bg-navy px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#161D52]"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/admin/audit"
            className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load audit events: {error.message}
        </div>
      ) : (events ?? []).length === 0 ? (
        <EmptyState
          icon={<Activity size={32} strokeWidth={1.4} />}
          title={hasFilters ? "No events match these filters" : "No events yet"}
          description={
            hasFilters
              ? "Try widening the filters, or clear them."
              : "Every mutation in the system is logged here — comments, transitions, uploads, logins."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[140px]">Time</th>
                  <th className="w-[140px]">Action</th>
                  <th>Target</th>
                  <th>Summary</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {events!.map((e) => {
                  const client = Array.isArray(e.client) ? e.client[0] : e.client;
                  const tone = ACTION_TONE[e.action] ?? {
                    bg: "bg-lightgrey",
                    text: "text-navy/65",
                    label: e.action,
                  };
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="text-[12px] tnum text-navy/85">
                          {format(new Date(e.occurred_at), "PP")}
                        </div>
                        <div className="text-[11px] text-navy/55">
                          {formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                            tone.bg +
                            " " +
                            tone.text
                          }
                        >
                          {tone.label}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-[11px] tnum text-navy/70">
                          {e.target_table}
                        </span>
                        {e.target_id ? (
                          <span className="block font-mono text-[10px] tnum text-navy/45">
                            {e.target_id.slice(0, 8)}…
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[13px] text-charcoal">
                        {e.summary ?? <span className="text-navy/45">—</span>}
                      </td>
                      <td>
                        {client ? (
                          <Link
                            href={`/admin/organizations/${client.id}`}
                            className="text-[13px] text-navy/85 hover:text-teal"
                          >
                            {client.display_name}
                          </Link>
                        ) : (
                          <span className="text-navy/45">—</span>
                        )}
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
                    href={buildHref({ action: actionFilter, target: targetFilter, page: String(page - 1) })}
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
                    href={buildHref({ action: actionFilter, target: targetFilter, page: String(page + 1) })}
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

function buildHref(params: { action?: string; target?: string; page?: string }): string {
  const sp = new URLSearchParams();
  if (params.action) sp.set("action", params.action);
  if (params.target) sp.set("target", params.target);
  if (params.page) sp.set("page", params.page);
  const qs = sp.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}
