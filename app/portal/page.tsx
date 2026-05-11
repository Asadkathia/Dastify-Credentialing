import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  Info,
  MessageSquare,
  Send,
} from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  BarChart,
  Donut,
  CHART_COLORS,
} from "@/components/charts/dashboard-charts";
import { StatusChip } from "@/components/ui/status-chip";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";
import type { LucideIcon } from "lucide-react";

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

      {/* ─── Master status card ───────────────────────────────────────────
          Navy hero banner with 4 stat cells + a horizontal timeline below.
          Every stage circle + label is clickable and deep-links to the
          enrollments list filtered to that status. */}
      <MasterStatusCard
        statusCounts={statusCounts}
        totalEnrollments={totalEnrollments}
      />

      {/* Non-par credentialed — terminal off-rail card sits below the
          linear timeline, visually offset (warning-amber accent). */}
      <NonParCard count={statusCounts.non_par_credentialed} />

      {/* Recently updated + Recent comments — directly under the timeline */}
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
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

      {/* Status donut + 12-month creations bar — secondary analytics row */}
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
    </div>
  );
}

// ─── Pipeline data ─────────────────────────────────────────────────────────
// Linear path — 5 stages. Each circle + label is a Link to
// /portal/enrollments?status=X. Non-par credentialed sits below as the
// terminal off-rail (see schema rule 17). Avg-progress = stage_idx / 5 per
// linear enrollment, averaged across the linear set; non-par is excluded
// from the progress calc since it doesn't sit on the rail.

type LinearStageKey = Exclude<EnrollmentStatus, "non_par_credentialed">;

type PipelineStage = {
  key: LinearStageKey;
  description: string;
  icon: LucideIcon;
};

const LINEAR_PIPELINE: ReadonlyArray<PipelineStage> = [
  {
    key: "prep",
    description: "Collecting provider credentials & documents",
    icon: FilePlus2,
  },
  { key: "submitted", description: "Application sent to the insurer", icon: Send },
  { key: "in_review", description: "Payer is verifying credentials", icon: Eye },
  { key: "approved", description: "Payer has accepted the provider", icon: CheckCircle2 },
  { key: "completed", description: "Provider is active in-network", icon: FileCheck2 },
];

function MasterStatusCard({
  statusCounts,
  totalEnrollments,
}: {
  statusCounts: Record<EnrollmentStatus, number>;
  totalEnrollments: number;
}) {
  // Linear-only counts feed the timeline + avg-progress math.
  const linearTotal = LINEAR_PIPELINE.reduce((sum, s) => sum + statusCounts[s.key], 0);
  // stage indices 1..5 → progress fraction
  const weighted = LINEAR_PIPELINE.reduce(
    (sum, s, i) => sum + statusCounts[s.key] * (i + 1),
    0,
  );
  const avgProgressPct =
    linearTotal > 0 ? Math.round((weighted / (linearTotal * LINEAR_PIPELINE.length)) * 100) : 0;

  // Track-fill — teal up to the right-most non-empty stage; grey thereafter.
  // (Visual hint for "the cohort has gotten this far at least somewhere.")
  const rightmostIdx = LINEAR_PIPELINE.reduce<number>(
    (m, s, i) => (statusCounts[s.key] > 0 ? i : m),
    -1,
  );
  const filledPct =
    rightmostIdx >= 0 ? (rightmostIdx / (LINEAR_PIPELINE.length - 1)) * 100 : 0;

  return (
    <section className="surface mb-6 overflow-hidden">
      {/* Navy hero header */}
      <div className="relative bg-navy px-6 py-6 text-white">
        {/* Decorative glows — same vibe as the new design's hero */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,193,194,0.16) 0%, rgba(22,193,194,0) 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(78,206,209,0.10) 0%, rgba(78,206,209,0) 70%)",
          }}
        />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.005em]">
              All Enrollment Statuses — Complete View
            </h2>
            <p className="mt-1 text-[13px] text-white/55">
              Every enrollment with live stage, payer, and pipeline progress
            </p>
          </div>

          <div className="grid shrink-0 grid-cols-4 gap-x-6 gap-y-2">
            <HeroStat label="Total" value={totalEnrollments} />
            <HeroStat label="In Prep" value={statusCounts.prep} />
            <HeroStat label="Approved" value={statusCounts.approved} />
            <HeroStat
              label="Avg Progress"
              value={linearTotal > 0 ? `${avgProgressPct}%` : "—"}
              accent
            />
          </div>
        </div>
      </div>

      {/* White timeline section */}
      <div className="px-6 py-8">
        <p className="label-sm mb-6">Pipeline overview — total across all enrollments</p>

        <ol
          className="relative grid grid-cols-2 gap-y-8 md:grid-cols-3 xl:grid-cols-5 xl:gap-y-0"
          aria-label="Enrollment pipeline"
        >
          {/* Connector track — only painted on xl+ where the row is horizontal */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-7 right-7 top-7 hidden h-0.5 bg-grey/40 xl:block"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-7 top-7 hidden h-0.5 bg-teal xl:block"
            style={{ width: `calc((100% - 56px) * ${filledPct / 100})` }}
          />

          {LINEAR_PIPELINE.map((stage, i) => {
            const count = statusCounts[stage.key];
            const isActive = count > 0;
            return (
              <li key={stage.key} className="relative">
                <Link
                  href={`/portal/enrollments?status=${stage.key}`}
                  aria-label={`${STATUS_LABELS[stage.key]} — ${count} enrollments`}
                  className="group flex flex-col items-center text-center"
                >
                  {/* Stage circle */}
                  <span
                    aria-hidden
                    className={
                      "relative z-10 mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all group-hover:scale-105 " +
                      (isActive
                        ? "border-teal bg-teal text-white shadow-[0_0_0_4px_var(--teal-12)]"
                        : "border-grey/60 bg-white text-navy/40 group-hover:border-teal/60")
                    }
                  >
                    <stage.icon size={20} strokeWidth={1.8} />
                  </span>

                  {/* Stage name */}
                  <span
                    className={
                      "text-[14px] font-semibold transition-colors " +
                      (isActive
                        ? "text-teal"
                        : "text-navy/45 group-hover:text-navy")
                    }
                  >
                    {STATUS_LABELS[stage.key]}
                  </span>

                  {/* Stage description */}
                  <span className="mt-1 max-w-[160px] text-[11px] leading-[15px] text-navy/45">
                    {stage.description}
                  </span>

                  {/* Count pill */}
                  <span
                    className={
                      "mt-3 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[12px] font-semibold tnum transition-colors " +
                      (isActive
                        ? "bg-teal-08 text-teal"
                        : "bg-lightgrey text-navy/35")
                    }
                  >
                    {count}
                  </span>

                  {/* Hover arrow */}
                  <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-teal opacity-0 transition-opacity group-hover:opacity-100">
                    View
                    <ArrowRight size={11} strokeWidth={1.8} />
                  </span>
                </Link>

                {/* Stage index (1..5) at the bottom of each item for screen readers */}
                <span className="sr-only">Stage {i + 1} of {LINEAR_PIPELINE.length}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[60px] text-right">
      <div
        className={
          "text-[28px] font-bold leading-none tracking-[-0.01em] tnum " +
          (accent ? "text-teal" : "text-white")
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
    </div>
  );
}

function NonParCard({ count }: { count: number }) {
  const hasItems = count > 0;
  return (
    <Link
      href="/portal/enrollments?status=non_par_credentialed"
      aria-label={`Non-par credentialed — ${count} enrollments`}
      className={
        "group mb-6 flex items-center gap-5 rounded-md border-l-[3px] bg-white px-5 py-4 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)] " +
        (hasItems
          ? "border-l-warning border-y border-r border-warning/30"
          : "border-l-grey border-y border-r border-border-subtle")
      }
    >
      <span
        aria-hidden
        className={
          "flex h-12 w-12 items-center justify-center rounded-full " +
          (hasItems
            ? "bg-warning-08 text-[#7a4f00]"
            : "bg-lightgrey text-navy/40")
        }
      >
        <CheckCircle2 size={20} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="label-sm">Off-rail outcome</span>
        </div>
        <p className="mt-0.5 text-[15px] font-semibold text-navy">Non-par credentialed</p>
        <p className="mt-0.5 text-[12px] text-navy/55">
          Credentialed by the payer but not added to the in-network roster.
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className={
            "text-[32px] font-bold leading-none tracking-[-0.01em] tnum " +
            (hasItems ? "text-[#7a4f00]" : "text-navy/35")
          }
        >
          {count}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-teal opacity-0 transition-opacity group-hover:opacity-100">
          View
          <ArrowRight size={11} strokeWidth={1.8} />
        </span>
      </div>
    </Link>
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
