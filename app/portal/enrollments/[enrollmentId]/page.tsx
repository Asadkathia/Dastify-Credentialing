import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentsThread } from "@/app/admin/organizations/[organizationId]/enrollments/[enrollmentId]/_components/comments-thread";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function ClientEnrollmentDetailPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  await requireOrganization();
  const { enrollmentId } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS enforces tenant isolation; if the enrollment isn't for this organization_id,
  // the query returns null and we 404 (NOT 403 — per CLAUDE.md, denied access
  // surfaces as not-found).
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(
      `*,
       provider:client_id (id, first_name, last_name),
       payer:payer_id (id, name)`,
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) notFound();

  const provider = Array.isArray(enrollment.provider)
    ? enrollment.provider[0]
    : enrollment.provider;
  const payer = Array.isArray(enrollment.payer) ? enrollment.payer[0] : enrollment.payer;
  const status = enrollment.status as EnrollmentStatus;

  const subjectLabel = provider
    ? `${provider.last_name}, ${provider.first_name}`
    : "—";

  const [{ data: comments }, { data: history }, { data: activity }] =
    await Promise.all([
      supabase
        .from("comments")
        .select("id, body, author_user_id, parent_comment_id, created_at")
        .eq("enrollment_id", enrollmentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("status_history")
        .select(
          "id, from_status, to_status, from_sub_status, to_sub_status, reason, changed_at",
        )
        .eq("enrollment_id", enrollmentId)
        .order("changed_at", { ascending: false })
        .limit(50),
      supabase
        .from("activity_events")
        .select("id, action, target_table, target_id, summary, occurred_at, actor_user_id")
        .eq("target_id", enrollmentId)
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

  return (
    <div>
      <PageHeader
        title={`${payer?.name ?? "Unknown payer"} · ${enrollment.state}`}
        subtitle={subjectLabel}
        crumbs={[
          { label: "Enrollments", href: "/portal/enrollments" },
          { label: `${payer?.name ?? ""} · ${enrollment.state}` },
        ]}
      />

      {/* Status snapshot + pipeline */}
      <section className="surface mb-6">
        <div className="border-b border-border-subtle px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={status} size="lg" />
            {enrollment.sub_status ? (
              <span className="text-[13px] text-navy/65">{enrollment.sub_status}</span>
            ) : null}
            <span className="ml-auto label-sm">Pipeline</span>
          </div>
        </div>
        <div className="px-5 py-6">
          <StatusPipeline status={status} />
        </div>

        {(enrollment.effective_date || enrollment.submitted_at) ? (
          <dl className="grid gap-x-6 gap-y-3 border-t border-border-subtle px-5 py-4 text-[13px] md:grid-cols-3">
            {enrollment.submitted_at ? (
              <Meta label="Submitted" value={format(new Date(enrollment.submitted_at), "PP")} />
            ) : null}
            {enrollment.effective_date ? (
              <Meta
                label="Effective"
                value={format(new Date(enrollment.effective_date), "PP")}
              />
            ) : null}
          </dl>
        ) : null}
      </section>

      {/* Tabs — Internal Notes deliberately absent in client view per CLAUDE.md §C5 */}
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
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="surface lg:col-span-2">
              <header className="border-b border-border-subtle px-5 py-4">
                <h2 className="text-[15px] font-semibold text-navy">Latest activity</h2>
              </header>
              {!activity || activity.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-navy/55">
                  No activity yet.
                </p>
              ) : (
                <ol className="divide-y divide-border-subtle">
                  {activity.slice(0, 8).map((a) => (
                    <li key={a.id} className="px-5 py-3.5 text-[13px]">
                      <div className="flex items-center gap-2">
                        <Activity size={12} className="shrink-0 text-teal" strokeWidth={1.6} />
                        <span className="font-semibold uppercase tracking-[0.06em] text-[11px] text-navy/70">
                          {a.action.replace(/_/g, " ")}
                        </span>
                        <span className="ml-auto tnum text-[11px] text-navy/55">
                          {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                        </span>
                      </div>
                      {a.summary ? (
                        <p className="mt-1 text-[12px] text-charcoal">{a.summary}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <aside className="surface">
              <header className="border-b border-border-subtle px-5 py-4">
                <h2 className="text-[15px] font-semibold text-navy">Enrollment info</h2>
              </header>
              <dl className="space-y-4 px-5 py-5 text-[13px]">
                <Meta label="Created" value={format(new Date(enrollment.created_at), "PP")} />
                <Meta
                  label="Updated"
                  value={formatDistanceToNow(new Date(enrollment.updated_at), { addSuffix: true })}
                />
              </dl>
            </aside>
          </div>
        </TabsContent>

        {/* Status History */}
        <TabsContent value="history">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Status history</h2>
            </header>
            {!history || history.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-navy/55">No history yet.</p>
            ) : (
              <ol className="divide-y divide-border-subtle">
                {history.map((h) => {
                  const from = h.from_status as EnrollmentStatus | null;
                  const to = h.to_status as EnrollmentStatus;
                  return (
                    <li key={h.id} className="space-y-1.5 px-5 py-4">
                      <div className="flex items-center gap-2 text-[11px]">
                        {from ? (
                          <>
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy/55">
                              {STATUS_LABELS[from]}
                            </span>
                            <ArrowRight size={12} className="text-navy/30" strokeWidth={1.6} />
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy">
                              {STATUS_LABELS[to]}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy/55">
                              Created
                            </span>
                            <ArrowRight size={12} className="text-navy/30" strokeWidth={1.6} />
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy">
                              {STATUS_LABELS[to]}
                            </span>
                          </>
                        )}
                        <span className="ml-auto tnum text-navy/55">
                          {format(new Date(h.changed_at), "PP · p")}
                        </span>
                      </div>
                      {h.to_sub_status ? (
                        <p className="text-[12px] italic text-navy/65">
                          sub-status → {h.to_sub_status}
                        </p>
                      ) : null}
                      {h.reason ? (
                        <p className="text-[13px] text-charcoal">{h.reason}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </TabsContent>

        {/* Comments — writable */}
        <TabsContent value="comments">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Comments</h2>
            </header>
            <div className="px-5 py-5">
              <CommentsThread enrollmentId={enrollmentId} comments={comments ?? []} allowPost />
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
