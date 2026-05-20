import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  FileText,
  MessageSquare,
  Plus,
  RefreshCw,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusPill } from "@/components/ui/status-pill";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTransitionDialog } from "./_components/status-transition-dialog";
import { DeleteEnrollmentDialog } from "@/components/admin/delete-enrollment-dialog";
import { CommentsThread } from "./_components/comments-thread";
import { InternalNotesThread } from "./_components/internal-notes-thread";
import { QuickActionCard } from "./_components/quick-action-card";
import { STATUS_LABELS, pipelineDisplayOrder } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

type LatestActivityEntry =
  | {
      kind: "status_change";
      id: string;
      from: EnrollmentStatus | null;
      to: EnrollmentStatus;
      reason: string | null;
      subStatus: string | null;
      at: Date;
    }
  | {
      kind: "event";
      id: string;
      action: string;
      summary: string | null;
      at: Date;
    };

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; enrollmentId: string }>;
}) {
  const { organizationId, enrollmentId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(
      `*,
       client:organization_id (id, display_name),
       provider:client_id (id, first_name, last_name, npi),
       payer:payer_id (id, name, payer_type)`,
    )
    .eq("id", enrollmentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!enrollment) notFound();

  const client = Array.isArray(enrollment.client) ? enrollment.client[0] : enrollment.client;
  const provider = Array.isArray(enrollment.provider)
    ? enrollment.provider[0]
    : enrollment.provider;
  const payer = Array.isArray(enrollment.payer) ? enrollment.payer[0] : enrollment.payer;

  const subjectLabel = provider
    ? `${provider.last_name}, ${provider.first_name}`
    : "—";

  const status = enrollment.status as EnrollmentStatus;

  const pipelineOrder = pipelineDisplayOrder();
  const pipelineStepIdx = pipelineOrder.indexOf(status);
  const isOffRailTerminal = pipelineStepIdx === -1;

  const [
    { data: history },
    { data: comments },
    { data: notes },
    { data: activity },
  ] = await Promise.all([
    supabase
      .from("status_history")
      .select(
        "id, from_status, to_status, from_sub_status, to_sub_status, reason, changed_by_user_id, changed_at",
      )
      .eq("enrollment_id", enrollmentId)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase
      .from("comments")
      .select("id, body, author_user_id, parent_comment_id, created_at")
      .eq("enrollment_id", enrollmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("internal_notes")
      .select("id, body, author_user_id, parent_note_id, created_at")
      .eq("enrollment_id", enrollmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("activity_events")
      .select("id, action, target_table, target_id, summary, occurred_at, actor_user_id")
      .eq("target_id", enrollmentId)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  // Merge status_history + activity_events into a unified Latest Activity feed.
  // Status changes come from history (so we get clean enum values for pill rendering,
  // not stale free-text summaries that drift when enums change).
  const latestActivity: LatestActivityEntry[] = [
    ...(history ?? []).map((h) => ({
      kind: "status_change" as const,
      id: `h-${h.id}`,
      from: h.from_status as EnrollmentStatus | null,
      to: h.to_status as EnrollmentStatus,
      reason: h.reason,
      subStatus: h.to_sub_status,
      at: new Date(h.changed_at),
    })),
    ...(activity ?? [])
      .filter((a) => a.action !== "status_change")
      .map((a) => ({
        kind: "event" as const,
        id: `e-${a.id}`,
        action: a.action,
        summary: a.summary,
        at: new Date(a.occurred_at),
      })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        icon={<FileText size={22} strokeWidth={1.7} />}
        title={`${payer?.name ?? "Unknown payer"} · ${enrollment.state}`}
        subtitle={
          <>
            {subjectLabel}
            {provider?.npi ? (
              <>
                {" · "}
                <span className="font-mono tnum">NPI {provider.npi}</span>
              </>
            ) : null}
          </>
        }
        crumbs={[
          { label: "Clients", href: "/admin/organizations" },
          { label: client?.display_name ?? "Client", href: `/admin/organizations/${organizationId}` },
          { label: "Enrollment" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusTransitionDialog
              enrollmentId={enrollmentId}
              currentStatus={status}
              currentSubStatus={enrollment.sub_status ?? ""}
            />
            <DeleteEnrollmentDialog
              enrollmentId={enrollmentId}
              label={`${payer?.name ?? "Unknown payer"} · ${enrollment.state}`}
              redirectTo={`/admin/organizations/${organizationId}`}
            />
          </div>
        }
      />

      {/* Status snapshot + pipeline */}
      <section className="surface mb-6">
        <div className="border-b border-border-subtle px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={status} size="lg" />
            {enrollment.sub_status ? (
              <span className="text-[13px] text-navy/65">{enrollment.sub_status}</span>
            ) : null}
            <div className="ml-auto flex flex-col items-end leading-tight">
              <span className="label-sm">Pipeline</span>
              {isOffRailTerminal ? (
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-warning">
                  Off-rail terminal
                </span>
              ) : (
                <span className="text-[13px] font-semibold tnum text-navy">
                  Step {pipelineStepIdx + 1} of {pipelineOrder.length}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-6">
          <StatusPipeline status={status} subStatus={enrollment.sub_status ?? undefined} />
        </div>

        {(enrollment.effective_date || enrollment.submitted_at) ? (
          <dl className="grid gap-x-6 gap-y-3 border-t border-border-subtle px-5 py-4 text-[13px] md:grid-cols-3">
            {enrollment.submitted_at ? (
              <Meta label="Submitted" value={format(new Date(enrollment.submitted_at), "PP")} />
            ) : null}
            {enrollment.effective_date ? (
              <Meta label="Effective" value={format(new Date(enrollment.effective_date), "PP")} />
            ) : null}
          </dl>
        ) : null}
      </section>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">
            Status History
            <span className="ml-1.5 rounded-full bg-lightgrey px-1.5 py-px text-[10px] font-semibold tnum text-navy/65">
              {history?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="comments">
            Comments
            <span className="ml-1.5 rounded-full bg-lightgrey px-1.5 py-px text-[10px] font-semibold tnum text-navy/65">
              {comments?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="internal">
            Internal Notes
            <span className="ml-1.5 rounded-full bg-warning-08 px-1.5 py-px text-[10px] font-semibold tnum text-[#7a4f00]">
              {notes?.length ?? 0}
            </span>
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="surface lg:col-span-2">
              <header className="border-b border-border-subtle px-5 py-4">
                <h2 className="text-[15px] font-semibold text-navy">Latest activity</h2>
              </header>
              {latestActivity.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-navy/55">No activity yet.</p>
              ) : (
                <ol className="divide-y divide-border-subtle">
                  {latestActivity.map((entry) => {
                    const t =
                      entry.kind === "status_change"
                        ? enrollmentActivityTone("status_change")
                        : enrollmentActivityTone(entry.action);
                    const labelTone =
                      entry.kind === "status_change"
                        ? "text-teal"
                        : entry.kind === "event" && (entry.action === "create" || entry.action === "invite")
                          ? "text-[#1B5E20]"
                          : entry.kind === "event" && entry.action === "comment"
                            ? "text-[#0E7475]"
                            : "text-navy/70";
                    const label =
                      entry.kind === "status_change"
                        ? "Status change"
                        : entry.action.replace(/_/g, " ");
                    return (
                      <li key={entry.id} className="flex gap-3 px-5 py-3.5">
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ background: t.bg, color: t.fg }}
                        >
                          <t.Icon size={13} strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1 text-[13px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                "text-[10px] font-semibold uppercase tracking-[0.16em] " +
                                labelTone
                              }
                            >
                              {label}
                            </span>
                            <span className="ml-auto tnum text-[11px] text-navy/55">
                              {formatDistanceToNow(entry.at, { addSuffix: true })}
                            </span>
                          </div>

                          {entry.kind === "status_change" ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {entry.from ? (
                                <StatusPill status={entry.from} muted />
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-navy-04 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy/55">
                                  Created
                                </span>
                              )}
                              <ArrowRight size={12} className="text-navy/30" strokeWidth={1.7} />
                              <StatusPill status={entry.to} />
                            </div>
                          ) : entry.summary ? (
                            <p className="mt-1 text-[12px] text-charcoal">{entry.summary}</p>
                          ) : null}

                          {entry.kind === "status_change" && entry.reason ? (
                            <p className="mt-1.5 text-[12px] text-charcoal/85">{entry.reason}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <div>
              <aside className="surface">
                <header className="border-b border-border-subtle px-5 py-4">
                  <h2 className="text-[15px] font-semibold text-navy">Enrollment info</h2>
                </header>
                <dl className="space-y-4 px-5 py-5 text-[13px]">
                  <Meta
                    label="Created"
                    value={format(new Date(enrollment.created_at), "PP")}
                  />
                  <Meta
                    label="Updated"
                    value={formatDistanceToNow(new Date(enrollment.updated_at), {
                      addSuffix: true,
                    })}
                  />
                </dl>
              </aside>
              <QuickActionCard
                enrollmentId={enrollmentId}
                currentStatus={status}
                currentSubStatus={enrollment.sub_status ?? ""}
              />
            </div>
          </div>
        </TabsContent>

        {/* Status History — table with From-badge → To-badge */}
        <TabsContent value="history">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Status history</h2>
            </header>
            {!history || history.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-navy/55">No history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[180px]">From</th>
                      <th className="w-[40px]" />
                      <th className="w-[180px]">To</th>
                      <th>Reason / sub-status</th>
                      <th className="w-[160px]">Changed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const from = h.from_status as EnrollmentStatus | null;
                      const to = h.to_status as EnrollmentStatus;
                      return (
                        <tr key={h.id}>
                          <td>
                            {from ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-04 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy/65">
                                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-navy/40" />
                                {STATUS_LABELS[from]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-navy-04 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy/55">
                                Created
                              </span>
                            )}
                          </td>
                          <td>
                            <ArrowRight size={14} className="text-navy/30" strokeWidth={1.7} />
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-08 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal">
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal" />
                              {STATUS_LABELS[to]}
                            </span>
                          </td>
                          <td className="text-[12px] text-charcoal">
                            {h.to_sub_status ? (
                              <p className="italic text-navy/65">{h.to_sub_status}</p>
                            ) : null}
                            {h.reason ? <p>{h.reason}</p> : null}
                            {!h.reason && !h.to_sub_status ? (
                              <span className="text-navy/40">—</span>
                            ) : null}
                          </td>
                          <td className="text-[11px] tnum text-navy/65">
                            {format(new Date(h.changed_at), "PP · p")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        {/* Comments */}
        <TabsContent value="comments">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Client-visible comments</h2>
            </header>
            <div className="px-5 py-5">
              <CommentsThread enrollmentId={enrollmentId} comments={comments ?? []} allowPost />
            </div>
          </section>
        </TabsContent>

        {/* Internal Notes */}
        <TabsContent value="internal">
          <section className="rounded-md border border-warning/30 bg-warning-08 shadow-[var(--shadow-xs)]">
            <header className="border-b border-warning/20 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Internal notes</h2>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[#7a4f00]">
                Admin-only — never returned to client sessions
              </p>
            </header>
            <div className="px-5 py-5">
              <InternalNotesThread enrollmentId={enrollmentId} notes={notes ?? []} />
            </div>
          </section>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Full activity log</h2>
            </header>
            {!activity || activity.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-navy/55">No activity yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-[140px]">Time</th>
                    <th className="w-[160px]">Action</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="text-[12px] tnum text-navy/85">
                          {format(new Date(a.occurred_at), "PP")}
                        </div>
                        <div className="text-[11px] text-navy/55">
                          {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                        </div>
                      </td>
                      <td>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/85">
                          {a.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="text-[13px] text-charcoal">
                        {a.summary ?? <span className="text-navy/45">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd className="mt-1 tnum text-charcoal">{value}</dd>
    </div>
  );
}

function enrollmentActivityTone(action: string): {
  bg: string;
  fg: string;
  Icon: typeof Activity;
} {
  if (action === "status_change") {
    return { bg: "rgba(22,193,194,0.10)", fg: "#0E7475", Icon: ArrowRightLeft };
  }
  if (action === "create" || action === "invite") {
    return { bg: "rgba(46,125,50,0.10)", fg: "#1B5E20", Icon: Plus };
  }
  if (action === "comment") {
    return { bg: "rgba(78,206,209,0.12)", fg: "#0E7475", Icon: MessageSquare };
  }
  if (action === "update") {
    return { bg: "rgba(244,163,0,0.12)", fg: "#A66A00", Icon: RefreshCw };
  }
  return { bg: "rgba(14,20,60,0.06)", fg: "#0E143C", Icon: FileText };
}
