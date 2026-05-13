import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  Info,
  MessageSquare,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { requireOrganization } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MiniPipeline } from "@/components/ui/mini-pipeline";
import { PayerMark } from "@/components/ui/payer-mark";
import { StatusChip } from "@/components/ui/status-chip";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";
import type { LucideIcon } from "lucide-react";

export default async function ClientPortalDashboardPage() {
  const session = await requireOrganization();
  const supabase = await createSupabaseServerClient();
  const today = new Date();

  // RLS scopes every query below to this organization_id automatically.
  const [
    { data: settings },
    { data: allEnrollments },
    { data: recentlyUpdated },
    { data: recentComments },
  ] = await Promise.all([
    supabase
      .from("organization_settings")
      .select("disclaimer_banner_text")
      .eq("organization_id", session.organizationId)
      .maybeSingle(),

    supabase
      .from("enrollments")
      .select(
        `id, state, status,
         provider:client_id (first_name, last_name),
         group_entity:group_entity_id (legal_name),
         payer:payer_id (name)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status, updated_at,
         provider:client_id (first_name, last_name),
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
           provider:client_id (first_name, last_name),
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
            <span className="font-semibold text-teal tnum">{format(today, "PP")}</span>.
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

      {/* Recently updated + Recent comments — directly under the master pipeline */}
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

      {/* All-enrollments pipeline-position listing + Non-par credentialed card
          — 50/50 split row below the recently-updated section. */}
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <AllEnrollmentsListing enrollments={allEnrollments ?? []} />
        <NonParCard count={statusCounts.non_par_credentialed} />
      </div>
    </div>
  );
}

// ─── Pipeline data ─────────────────────────────────────────────────────────
// Linear path — 4 stages. Each circle + label is a Link to
// /portal/enrollments?status=X. Non-par credentialed sits in the row below
// as the terminal off-rail (see schema rule 17). Avg-progress = stage_idx / 4
// per linear enrollment, averaged across the linear set; non-par is excluded
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
  { key: "approved", description: "Provider is active in-network", icon: CheckCircle2 },
];

type MasterEnrollmentRow = {
  id: string;
  state: string;
  status: string;
  provider: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  group_entity: { legal_name: string } | { legal_name: string }[] | null;
  payer: { name: string } | { name: string }[] | null;
};

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

  // This pipeline is a categorization view (all enrollments bucketed by
  // status), not a journey for a single enrollment — every stage is
  // permanently rendered in its assigned color regardless of count.

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

          <div className="grid shrink-0 grid-cols-3 gap-x-6 gap-y-2 md:grid-cols-6">
            <HeroStat label="Total" value={totalEnrollments} />
            <HeroStat label="In Prep" value={statusCounts.prep} />
            <HeroStat label="Submitted" value={statusCounts.submitted} />
            <HeroStat label="In Review" value={statusCounts.in_review} />
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
          className="relative grid grid-cols-2 gap-y-8 md:grid-cols-4 xl:grid-cols-4 xl:gap-y-0"
          aria-label="Enrollment pipeline"
        >
          {/* Connector track — always painted in brand teal, end-to-end.
              Stage-specific color lives only on the circles; the rail itself
              stays neutral teal so the visual hierarchy reads circles first. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-7 right-7 top-7 hidden h-0.5 bg-teal xl:block"
          />

          {LINEAR_PIPELINE.map((stage, i) => {
            const count = statusCounts[stage.key];
            const palette = STATUS_COLORS[stage.key];
            return (
              <li key={stage.key} className="relative">
                <Link
                  href={`/portal/enrollments?status=${stage.key}`}
                  aria-label={`${STATUS_LABELS[stage.key]} — ${count} enrollments`}
                  className="group flex flex-col items-center text-center"
                >
                  {/* Stage circle — every stage is permanently rendered in
                      its assigned status color, regardless of count. */}
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all group-hover:scale-105",
                      palette.classes.border,
                      palette.classes.bgSolid,
                      "text-white ring-4",
                      palette.classes.ring,
                    )}
                  >
                    <stage.icon size={20} strokeWidth={1.8} />
                  </span>

                  {/* Stage name */}
                  <span
                    className={cn(
                      "text-[14px] font-semibold",
                      palette.classes.text,
                    )}
                  >
                    {STATUS_LABELS[stage.key]}
                  </span>

                  {/* Stage description */}
                  <span className="mt-1 max-w-[160px] text-[11px] leading-[15px] text-navy/45">
                    {stage.description}
                  </span>

                  {/* Count pill — always tinted in the stage's color. */}
                  <span
                    className={cn(
                      "mt-3 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[12px] font-semibold tnum",
                      palette.classes.bgTint,
                      palette.classes.text,
                    )}
                  >
                    {count}
                  </span>

                  {/* Hover arrow */}
                  <span
                    className={cn(
                      "mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] opacity-0 transition-opacity group-hover:opacity-100",
                      palette.classes.text,
                    )}
                  >
                    View
                    <ArrowRight size={11} strokeWidth={1.8} />
                  </span>
                </Link>

                {/* Stage index (1..4) at the bottom of each item for screen readers */}
                <span className="sr-only">Stage {i + 1} of {LINEAR_PIPELINE.length}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function AllEnrollmentsListing({ enrollments }: { enrollments: MasterEnrollmentRow[] }) {
  return (
    <section className="surface flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <h2 className="text-[15px] font-semibold text-navy">
          All enrollments — pipeline position
        </h2>
        <span className="tnum text-[11px] text-navy/55">{enrollments.length} total</span>
      </header>
      {enrollments.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-navy/55">No enrollments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Payer</th>
                <th className="w-[56px]">State</th>
                <th className="w-[150px]">Pipeline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => {
                const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                const groupEntity = Array.isArray(e.group_entity)
                  ? e.group_entity[0]
                  : e.group_entity;
                const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                const subject = provider
                  ? `${provider.last_name}, ${provider.first_name}`
                  : (groupEntity?.legal_name ?? "—");
                const status = e.status as EnrollmentStatus;
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/portal/enrollments/${e.id}`}
                        className="text-[13px] font-medium text-navy hover:text-teal"
                      >
                        {subject}
                      </Link>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <PayerMark name={payer?.name ?? "??"} size={22} />
                        <span className="text-navy/85">{payer?.name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="font-mono text-[12px] text-navy/70 tnum">{e.state}</td>
                    <td>
                      <MiniPipeline status={status} />
                    </td>
                    <td>
                      <StatusChip status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
        "group flex h-full items-center gap-5 rounded-md border-l-[3px] bg-white px-5 py-4 shadow-[var(--shadow-xs)] transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)] " +
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
