import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertOctagon,
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  Send,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { DesignKpi } from "@/components/ui/design-kpi";
import {
  BarChart,
  Donut,
  CHART_COLORS,
} from "@/components/charts/dashboard-charts";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { STATUS_COLORS, type StatusToneName } from "@/lib/enrollment/status-colors";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";

const STATUS_KPI_META: Record<
  EnrollmentStatus,
  { tone: StatusToneName; icon: LucideIcon; hint: string }
> = {
  prep: { tone: STATUS_COLORS.prep.toneName, icon: FilePlus2, hint: "Gathering documents" },
  submitted: { tone: STATUS_COLORS.submitted.toneName, icon: Send, hint: "Awaiting payer pickup" },
  in_review: { tone: STATUS_COLORS.in_review.toneName, icon: Eye, hint: "With payer reviewer" },
  approved: { tone: STATUS_COLORS.approved.toneName, icon: CheckCircle2, hint: "Active in-network" },
  non_par_credentialed: {
    tone: STATUS_COLORS.non_par_credentialed.toneName,
    icon: AlertOctagon,
    hint: "Credentialed off-network",
  },
};

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  // 12 monthly buckets ending in the current month.
  const months: Array<{ label: string; start: Date; end: Date; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    months.push({
      label: format(start, "MMM"),
      start,
      end,
      count: 0,
    });
  }
  const earliestMonthStart = months[0]!.start;

  const [
    { data: allEnrollments },
    { data: createdInWindow },
    { data: nonParInWindow },
    { data: recentlyUpdated },
  ] = await Promise.all([
    // Used for the 5 KPI counts + donut.
    supabase
      .from("enrollments")
      .select("id, status")
      .is("deleted_at", null),

    // Used for the 12-month creations bar.
    supabase
      .from("enrollments")
      .select("created_at")
      .gte("created_at", earliestMonthStart.toISOString())
      .is("deleted_at", null),

    // Used for the 12-month non-par-credentialed bar chart — transitions
    // into `non_par_credentialed` bucketed by month.
    supabase
      .from("status_history")
      .select("created_at")
      .eq("to_status", "non_par_credentialed")
      .gte("created_at", earliestMonthStart.toISOString())
      .limit(5000),

    // Recently updated — extended view at the bottom of the dashboard.
    supabase
      .from("enrollments")
      .select(
        `id, client_id, state, status, sub_status, updated_at,
         client:client_id (id, display_name),
         provider:provider_id (first_name, last_name),
         group_entity:group_entity_id (legal_name),
         payer:payer_id (name)`,
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  // Per-status counts (drives the 5 KPI cards + donut).
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

  // 12-month creations bucketing.
  (createdInWindow ?? []).forEach((e) => {
    const at = new Date(e.created_at);
    const bucket = months.find((m) => at >= m.start && at < m.end);
    if (bucket) bucket.count += 1;
  });

  // 12-month non-par-credentialed bucketing — mirrors the creations loop.
  const nonParMonths = months.map((m) => ({
    label: m.label,
    start: m.start,
    end: m.end,
    count: 0,
  }));
  (nonParInWindow ?? []).forEach((ev) => {
    const at = new Date(ev.created_at);
    const bucket = nonParMonths.find((m) => at >= m.start && at < m.end);
    if (bucket) bucket.count += 1;
  });

  // Donut data — exclude zero-count statuses for visual clarity.
  const donutData = ENROLLMENT_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABELS[s],
    value: statusCounts[s],
    color: STATUS_COLORS[s].hex,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            At-a-glance enrollment counts by status across all clients. Updated{" "}
            <span className="font-semibold text-teal tnum">{format(today, "PP")}</span>.
          </>
        }
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/monthly-enrollments.xlsx">
              <Download size={14} strokeWidth={1.6} className="mr-1.5" />
              Monthly report
            </a>
          </Button>
        }
      />

      {/* KPI band — one card per status, clickable */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ENROLLMENT_STATUSES.map((s) => {
          const meta = STATUS_KPI_META[s];
          return (
            <Link
              key={s}
              href={`/admin/enrollments?status=${s}`}
              className="block"
            >
              <DesignKpi
                label={STATUS_LABELS[s].toUpperCase()}
                value={statusCounts[s]}
                hint={meta.hint}
                icon={meta.icon}
                tone={meta.tone}
                className="transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)]"
              />
            </Link>
          );
        })}
      </div>

      {/* Charts — 3 equal columns: donut + creations + non-par credentialed */}
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
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
          live
        >
          <BarChart
            data={months.map((m) => ({ label: m.label, value: m.count, color: CHART_COLORS.teal }))}
          />
        </ChartCard>

        <ChartCard
          title="Non-par credentialed · last 12 months"
          caption="Transitions into non-par credentialed per calendar month."
        >
          <BarChart
            data={nonParMonths.map((m) => ({
              label: m.label,
              value: m.count,
              color: CHART_COLORS.amber,
            }))}
          />
        </ChartCard>
      </div>

      {/* Recently updated — extended table at the bottom */}
      <section className="surface mb-6">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-navy">Recently updated</h2>
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-teal-12 px-1.5 text-[11px] font-semibold text-teal tnum">
              {recentlyUpdated?.length ?? 0}
            </span>
          </div>
          <Link
            href="/admin/enrollments"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
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
                <th>Client</th>
                <th>Payer · State</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentlyUpdated.map((r) => {
                const client = Array.isArray(r.client) ? r.client[0] : r.client;
                const provider = Array.isArray(r.provider) ? r.provider[0] : r.provider;
                const groupEntity = Array.isArray(r.group_entity)
                  ? r.group_entity[0]
                  : r.group_entity;
                const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
                const subject = provider
                  ? `${provider.last_name}, ${provider.first_name}`
                  : (groupEntity?.legal_name ?? "—");
                const detailHref = client
                  ? `/admin/clients/${client.id}/enrollments/${r.id}`
                  : "#";
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={detailHref} className="font-medium text-navy hover:text-teal">
                        {subject}
                      </Link>
                    </td>
                    <td className="text-navy/70">{client?.display_name ?? "—"}</td>
                    <td className="text-navy/70">
                      {payer?.name ?? "—"} ·{" "}
                      <span className="font-mono tnum">{r.state}</span>
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
    </div>
  );
}

function ChartCard({
  title,
  caption,
  live,
  children,
}: {
  title: string;
  caption?: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)]">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-5 text-navy">{title}</h3>
          {caption ? <p className="mt-0.5 text-[12px] font-light leading-[18px] text-navy/40">{caption}</p> : null}
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal" />
            Live
          </span>
        ) : null}
      </header>
      <div className="pt-2">{children}</div>
    </div>
  );
}
