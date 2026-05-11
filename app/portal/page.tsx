import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Download, Info, MessageSquare } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import {
  BarChart,
  Donut,
  CHART_COLORS,
} from "@/components/charts/dashboard-charts";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";

const STATUS_DOT: Record<EnrollmentStatus, string> = {
  prep: CHART_COLORS.aqua,
  submitted: CHART_COLORS.teal,
  in_review: CHART_COLORS.teal,
  approved: CHART_COLORS.green,
  non_par_credentialed: CHART_COLORS.amber,
  completed: CHART_COLORS.green,
};

export default async function ClientPortalDashboardPage() {
  const session = await requireClient();
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  // 12 monthly buckets ending in the current month.
  const months: Array<{ label: string; start: Date; end: Date; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    months.push({ label: format(start, "MMM"), start, end, count: 0 });
  }
  const earliestMonthStart = months[0]!.start;

  // RLS scopes every query below to this client_id automatically.
  const [
    { data: settings },
    { data: allEnrollments },
    { data: createdInWindow },
    { data: recentlyUpdated },
    { data: recentComments },
  ] = await Promise.all([
    supabase
      .from("client_settings")
      .select("disclaimer_banner_text")
      .eq("client_id", session.clientId)
      .maybeSingle(),

    supabase
      .from("enrollments")
      .select("id, status")
      .is("deleted_at", null),

    supabase
      .from("enrollments")
      .select("created_at")
      .gte("created_at", earliestMonthStart.toISOString())
      .is("deleted_at", null),

    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status, updated_at,
         provider:provider_id (first_name, last_name),
         group_entity:group_entity_id (legal_name),
         payer:payer_id (name)`,
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),

    supabase
      .from("comments")
      .select(
        `id, body, author_user_id, created_at,
         enrollment:enrollment_id (id, state,
           provider:provider_id (first_name, last_name),
           payer:payer_id (name))`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const statusCounts = ENROLLMENT_STATUSES.reduce<Record<EnrollmentStatus, number>>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<EnrollmentStatus, number>,
  );
  (allEnrollments ?? []).forEach((e) => {
    statusCounts[e.status as EnrollmentStatus] += 1;
  });
  const totalEnrollments = (allEnrollments ?? []).length;

  (createdInWindow ?? []).forEach((e) => {
    const at = new Date(e.created_at);
    const bucket = months.find((m) => at >= m.start && at < m.end);
    if (bucket) bucket.count += 1;
  });

  const donutData = ENROLLMENT_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    value: statusCounts[s],
    color: STATUS_DOT[s],
  }));

  return (
    <div>
      {/* Disclaimer banner — per CLAUDE.md rule 26 */}
      {settings?.disclaimer_banner_text ? (
        <div className="mb-6 flex items-start gap-3 rounded-md border-l-[3px] border-warning bg-warning-08 px-4 py-3 text-[13px] text-charcoal">
          <Info size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#7a4f00]" />
          <p>{settings.disclaimer_banner_text}</p>
        </div>
      ) : null}

      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            Enrollment counts by status across all your providers and payers. Updated{" "}
            <span className="font-mono tnum">{format(today, "PP")}</span>.
          </>
        }
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/enrollments.xlsx">
              <Download size={14} strokeWidth={1.6} className="mr-1.5" />
              Export to Excel
            </a>
          </Button>
        }
      />

      {/* KPI band — one card per status, clickable */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {ENROLLMENT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/portal/enrollments?status=${s}`}
            className="group block rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)] hover:border-teal/30"
          >
            <div className="mb-3">
              <StatusChip status={s} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-[32px] font-bold leading-none tracking-[-0.01em] tnum text-navy">
                {statusCounts[s]}
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-teal opacity-0 transition-opacity group-hover:opacity-100">
                View →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2 — donut + 12-month creations bar */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <ChartCard
          title="Status distribution"
          caption={`Snapshot — ${totalEnrollments} total enrollments`}
        >
          <div className="flex flex-col items-center gap-4">
            <Donut data={donutData} total={totalEnrollments} totalLabel="Total" />
            <ul className="w-full space-y-1 border-t border-border-subtle pt-3">
              {donutData.map((d) => {
                const pct =
                  totalEnrollments > 0 ? Math.round((d.value / totalEnrollments) * 100) : 0;
                return (
                  <li
                    key={d.key}
                    className="flex items-center justify-between gap-2 rounded px-1 py-[3px] text-[12px]"
                  >
                    <span className="flex items-center gap-2 truncate text-charcoal">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-[2px]"
                        style={{ background: d.color }}
                      />
                      {d.label}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="min-w-[36px] text-right font-semibold tnum text-charcoal">
                        {d.value}
                      </span>
                      <span className="min-w-[42px] text-right tnum text-[11px] text-navy/55">
                        {pct}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </ChartCard>

        <ChartCard
          title="Enrollments created · last 12 months"
          caption="New enrollment rows per calendar month."
        >
          <BarChart
            data={months.map((m) => ({ label: m.label, value: m.count, color: CHART_COLORS.teal }))}
          />
        </ChartCard>
      </div>

      {/* Row 3 — recently updated + recent comments */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface">
          <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[15px] font-semibold text-navy">Recently updated</h2>
            <Link
              href="/portal/enrollments"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-teal hover:text-[#0E7475]"
            >
              View all →
            </Link>
          </header>
          {!recentlyUpdated || recentlyUpdated.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-navy/55">No activity yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Payer · State</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentlyUpdated.map((r) => {
                  const provider = Array.isArray(r.provider) ? r.provider[0] : r.provider;
                  const groupEntity = Array.isArray(r.group_entity)
                    ? r.group_entity[0]
                    : r.group_entity;
                  const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
                  const subject = provider
                    ? `${provider.last_name}, ${provider.first_name}`
                    : (groupEntity?.legal_name ?? "—");
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/portal/enrollments/${r.id}`}
                          className="font-medium text-navy hover:text-teal"
                        >
                          {subject}
                        </Link>
                      </td>
                      <td className="text-navy/70">
                        {payer?.name ?? "—"} · <span className="font-mono tnum">{r.state}</span>
                      </td>
                      <td>
                        <StatusChip status={r.status as EnrollmentStatus} />
                      </td>
                      <td className="tnum text-[11px] text-navy/55">
                        {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="surface">
          <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[15px] font-semibold text-navy">Recent comments</h2>
            <span className="label-sm">{recentComments?.length ?? 0}</span>
          </header>
          {!recentComments || recentComments.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-navy/55">
              No comments yet on your enrollments.
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {recentComments.map((c) => {
                const enrollment = Array.isArray(c.enrollment) ? c.enrollment[0] : c.enrollment;
                const provider = enrollment?.provider
                  ? Array.isArray(enrollment.provider)
                    ? enrollment.provider[0]
                    : enrollment.provider
                  : null;
                const payer = enrollment?.payer
                  ? Array.isArray(enrollment.payer)
                    ? enrollment.payer[0]
                    : enrollment.payer
                  : null;
                const subject = provider
                  ? `${provider.last_name}, ${provider.first_name}`
                  : "—";
                return (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={enrollment ? `/portal/enrollments/${enrollment.id}` : "#"}
                        className="flex items-baseline gap-2 text-[12px] hover:text-teal"
                      >
                        <MessageSquare
                          size={11}
                          strokeWidth={1.6}
                          className="shrink-0 text-teal"
                        />
                        <span className="font-medium text-navy">{subject}</span>
                        {payer ? (
                          <span className="text-navy/55">
                            · {payer.name}
                            {enrollment?.state ? (
                              <>
                                {" "}
                                · <span className="font-mono tnum">{enrollment.state}</span>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                      </Link>
                      <span className="shrink-0 tnum text-[11px] text-navy/55">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-[20px] text-charcoal">
                      {c.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)]">
      <header className="mb-3">
        <h3 className="text-[14px] font-semibold leading-5 text-navy">{title}</h3>
        {caption ? <p className="mt-0.5 text-[12px] leading-[18px] text-navy/55">{caption}</p> : null}
      </header>
      <div className="pt-2">{children}</div>
    </div>
  );
}
