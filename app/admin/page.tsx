import Link from "next/link";
import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Donut,
  HorizontalBarList,
  LineChart,
  BarChart,
  Sparkline,
  CHART_COLORS,
} from "@/components/charts/dashboard-charts";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  intake: "Intake",
  prep: "Prep",
  submitted: "Submitted",
  in_review: "In Review",
  info_requested: "Info Requested",
  approved: "Approved",
  denied: "Denied",
  effective: "Effective",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

const STATUS_DOT: Record<EnrollmentStatus, string> = {
  intake: CHART_COLORS.grey,
  prep: CHART_COLORS.aqua,
  submitted: CHART_COLORS.teal,
  in_review: CHART_COLORS.teal,
  info_requested: CHART_COLORS.amber,
  approved: CHART_COLORS.green,
  denied: CHART_COLORS.red,
  effective: CHART_COLORS.green,
  closed: CHART_COLORS.grey,
  withdrawn: CHART_COLORS.grey,
};

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() + 90);
  const cutoff90Iso = cutoff90.toISOString().split("T")[0]!;

  const cutoff84d = new Date();
  cutoff84d.setDate(cutoff84d.getDate() - 84);

  const cutoffStuck = new Date();
  cutoffStuck.setDate(cutoffStuck.getDate() - 7);

  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  sixMonthsLater.setDate(0);

  const [
    { count: activeCount },
    { count: recredsDueCount },
    { count: infoReqCount },
    { data: allEnrollments },
    { data: transitions },
    { data: upcomingRecreds },
    { data: denialEvents },
    { data: recentlyUpdated },
    { data: stuck },
  ] = await Promise.all([
    // 1. Active enrollments
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("status", "in", "(closed,withdrawn)"),

    // 2. Recreds due 90d
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "effective")
      .not("next_recred_due_date", "is", null)
      .lte("next_recred_due_date", cutoff90Iso),

    // 3. Open info requests
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "info_requested")
      .is("deleted_at", null),

    // 4 & 6. All enrollments — for status distribution + time-to-effective compute
    supabase
      .from("enrollments")
      .select("id, status, created_at, effective_date")
      .is("deleted_at", null),

    // 5. Throughput — last 12 weeks of submitted/effective transitions
    supabase
      .from("status_history")
      .select("to_status, changed_at")
      .gte("changed_at", cutoff84d.toISOString())
      .in("to_status", ["submitted", "effective"])
      .limit(5000),

    // 7. Recred forecast — next 6 months
    supabase
      .from("enrollments")
      .select("next_recred_due_date, status")
      .eq("status", "effective")
      .not("next_recred_due_date", "is", null)
      .gte("next_recred_due_date", today.toISOString().split("T")[0]!)
      .lte("next_recred_due_date", sixMonthsLater.toISOString().split("T")[0]!),

    // 8. Denial rate by payer — last 90 days of submission/denial transitions
    supabase
      .from("status_history")
      .select(`to_status, enrollment:enrollment_id (payer:payer_id (id, name))`)
      .gte("changed_at", cutoff84d.toISOString())
      .in("to_status", ["submitted", "denied"])
      .limit(5000),

    // 9. Recently updated
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
      .limit(8),

    // 10. Stuck in info_requested (>7d idle)
    supabase
      .from("enrollments")
      .select(
        `id, client_id, state, updated_at,
         client:client_id (id, display_name),
         provider:provider_id (first_name, last_name),
         group_entity:group_entity_id (legal_name),
         payer:payer_id (name)`,
      )
      .eq("status", "info_requested")
      .lt("updated_at", cutoffStuck.toISOString())
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(8),
  ]);

  // Median time-to-effective (days), computed in JS over the loaded set.
  const ttd = (allEnrollments ?? [])
    .filter((e) => e.effective_date && e.created_at)
    .map((e) => differenceInCalendarDays(new Date(e.effective_date!), new Date(e.created_at!)))
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const medianTTE = ttd.length > 0 ? ttd[Math.floor(ttd.length / 2)]! : null;

  // Status distribution
  const statusCounts = ENROLLMENT_STATUSES.reduce<Record<EnrollmentStatus, number>>(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<EnrollmentStatus, number>,
  );
  (allEnrollments ?? []).forEach((e) => {
    const s = e.status as EnrollmentStatus;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  });
  const donutData = ENROLLMENT_STATUSES.map((s) => ({
    key: s,
    label: STATUS_LABEL[s],
    value: statusCounts[s],
    color: STATUS_DOT[s],
  }));
  const totalDonut = donutData.reduce((s, d) => s + d.value, 0);

  // Throughput — 12 weeks, bucketed
  const weeks: Array<{ label: string; start: Date; submitted: number; effective: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() - i * 7);
    weeks.push({
      label: `W${weekOfYear(start)}`,
      start,
      submitted: 0,
      effective: 0,
    });
  }
  (transitions ?? []).forEach((t) => {
    const at = new Date(t.changed_at);
    const w = weeks.find((week, i) => {
      const next = weeks[i + 1]?.start;
      return at >= week.start && (!next || at < next);
    });
    if (!w) return;
    if (t.to_status === "submitted") w.submitted += 1;
    else if (t.to_status === "effective") w.effective += 1;
  });

  // Recred forecast — 6 months ahead
  const months: Array<{ label: string; key: string; count: number }> = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      label: d.toLocaleString("en-US", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    });
  }
  (upcomingRecreds ?? []).forEach((r) => {
    if (!r.next_recred_due_date) return;
    const d = new Date(r.next_recred_due_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.count += 1;
  });

  // Denial rate by payer — last 90 days, top 10 by submissions
  const payerStats = new Map<string, { name: string; submissions: number; denials: number }>();
  (denialEvents ?? []).forEach((ev) => {
    const enrollment = Array.isArray(ev.enrollment) ? ev.enrollment[0] : ev.enrollment;
    const payer = enrollment?.payer
      ? Array.isArray(enrollment.payer)
        ? enrollment.payer[0]
        : enrollment.payer
      : null;
    if (!payer?.id) return;
    const entry = payerStats.get(payer.id) ?? {
      name: payer.name,
      submissions: 0,
      denials: 0,
    };
    if (ev.to_status === "submitted") entry.submissions += 1;
    if (ev.to_status === "denied") entry.denials += 1;
    payerStats.set(payer.id, entry);
  });
  const denialRows = Array.from(payerStats.values())
    .filter((p) => p.submissions > 0)
    .map((p) => ({
      label: p.name,
      value: Math.round((p.denials / p.submissions) * 1000) / 10,
      max: 25,
      suffix: `(${p.submissions})`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // KPI sparklines — synthesized from the last 12 weeks of derived signals
  const sparkSubmissions = weeks.map((w) => w.submitted);
  const sparkEffective = weeks.map((w) => w.effective);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            At-a-glance workload across all clients. Updated{" "}
            <span className="font-mono tnum">{format(today, "PP")}</span>.
          </>
        }
      />

      {/* KPI band */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active enrollments"
          value={activeCount ?? 0}
          spark={sparkSubmissions}
          color="navy"
        />
        <KpiCard
          label="Recreds due 90d"
          value={recredsDueCount ?? 0}
          spark={months.map((m) => m.count)}
          color="amber"
        />
        <KpiCard
          label="Open info requests"
          value={infoReqCount ?? 0}
          spark={weeks.map((w) => w.submitted)}
          color="amber"
        />
        <KpiCard
          label="Median time-to-effective"
          value={medianTTE ?? "—"}
          suffix={medianTTE != null ? "d" : ""}
          spark={sparkEffective}
          color="teal"
        />
      </div>

      {/* Row 2 — throughput + status mix */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <ChartCard
          title="Throughput · last 12 weeks"
          caption="Enrollments transitioning to Submitted / Effective per week."
          legend={[
            { color: CHART_COLORS.navy, label: "Submitted" },
            { color: CHART_COLORS.teal, label: "Effective" },
          ]}
        >
          <LineChart
            labels={weeks.map((w) => w.label)}
            series={[
              { name: "Submitted", color: CHART_COLORS.navy, data: weeks.map((w) => w.submitted) },
              { name: "Effective", color: CHART_COLORS.teal, data: weeks.map((w) => w.effective) },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Active enrollments by status"
          caption="Snapshot — current"
        >
          <div className="flex flex-col items-center gap-4">
            <Donut data={donutData} total={totalDonut} totalLabel="Active" />
            <ul className="w-full space-y-1 border-t border-border-subtle pt-3">
              {donutData.map((d) => {
                const pct = totalDonut > 0 ? Math.round((d.value / totalDonut) * 100) : 0;
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
      </div>

      {/* Row 3 — risk surfaces */}
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Recreds forecast · next 6 months"
          caption="Effective enrollments due for recredentialing per month."
        >
          <BarChart
            data={months.map((m) => ({ label: m.label, value: m.count, color: CHART_COLORS.teal }))}
          />
        </ChartCard>

        <ChartCard
          title="Denial rate · top 10 payers"
          caption="By denominator: submissions in last 90 days."
        >
          {denialRows.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-navy/55">
              Not enough data yet — denial rates appear once payers accumulate submissions.
            </p>
          ) : (
            <HorizontalBarList
              data={denialRows}
              formatValue={(v) => `${v.toFixed(1)}%`}
              barFill={CHART_COLORS.red}
            />
          )}
        </ChartCard>
      </div>

      {/* Row 4 — queues */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface">
          <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[15px] font-semibold text-navy">Recently updated</h2>
            <Link
              href="/admin/enrollments"
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
                        {client ? (
                          <span className="block text-[11px] text-navy/55">
                            {client.display_name}
                          </span>
                        ) : null}
                      </td>
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

        <section className="surface">
          <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="text-[15px] font-semibold text-navy">Stuck in info-requested</h2>
            <Link
              href="/admin/enrollments?status=info_requested"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-teal hover:text-[#0E7475]"
            >
              View all →
            </Link>
          </header>
          {!stuck || stuck.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-navy/55">
              No enrollments stuck &gt; 7 days — clean queue.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Payer · State</th>
                  <th>Days idle</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((r) => {
                  const client = Array.isArray(r.client) ? r.client[0] : r.client;
                  const provider = Array.isArray(r.provider) ? r.provider[0] : r.provider;
                  const groupEntity = Array.isArray(r.group_entity)
                    ? r.group_entity[0]
                    : r.group_entity;
                  const payer = Array.isArray(r.payer) ? r.payer[0] : r.payer;
                  const subject = provider
                    ? `${provider.last_name}, ${provider.first_name}`
                    : (groupEntity?.legal_name ?? "—");
                  const days = differenceInCalendarDays(new Date(), new Date(r.updated_at));
                  const detailHref = client
                    ? `/admin/clients/${client.id}/enrollments/${r.id}`
                    : "#";
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={detailHref} className="font-medium text-navy hover:text-teal">
                          {subject}
                        </Link>
                        {client ? (
                          <span className="block text-[11px] text-navy/55">
                            {client.display_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-navy/70">
                        {payer?.name ?? "—"} ·{" "}
                        <span className="font-mono tnum">{r.state}</span>
                      </td>
                      <td>
                        <span
                          className={
                            "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold tnum " +
                            (days >= 14
                              ? "bg-danger-08 text-danger"
                              : days >= 7
                                ? "bg-warning-08 text-[#7a4f00]"
                                : "bg-lightgrey text-navy/70")
                          }
                        >
                          {days}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  spark,
  color,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  spark: number[];
  color: "navy" | "teal" | "amber";
}) {
  const sparkColor =
    color === "navy" ? CHART_COLORS.navy : color === "amber" ? CHART_COLORS.amber : CHART_COLORS.teal;
  return (
    <div className="rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]">
      <p className="label-sm">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-[32px] font-bold leading-none tracking-[-0.01em] tnum text-navy">
          {value}
          {suffix ? <span className="ml-0.5 text-[18px] font-medium text-navy/55">{suffix}</span> : null}
        </p>
        <Sparkline data={spark} color={sparkColor} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  caption,
  legend,
  children,
}: {
  title: string;
  caption?: string;
  legend?: Array<{ color: string; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)]">
      <header className="mb-3">
        <h3 className="text-[14px] font-semibold leading-5 text-navy">{title}</h3>
        {caption ? <p className="mt-0.5 text-[12px] leading-[18px] text-navy/55">{caption}</p> : null}
      </header>
      <div className="pt-2">{children}</div>
      {legend && legend.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border-subtle pt-3 text-[12px] text-navy/70">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 font-medium">
              <span
                aria-hidden
                className="h-2 w-2 rounded-[2px]"
                style={{ background: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function weekOfYear(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
