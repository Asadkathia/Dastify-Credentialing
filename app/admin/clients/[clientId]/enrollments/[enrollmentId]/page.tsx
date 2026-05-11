import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusPipeline } from "@/components/ui/status-pipeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusTransitionDialog } from "./_components/status-transition-dialog";
import { CommentsThread } from "./_components/comments-thread";
import { InternalNotesThread } from "./_components/internal-notes-thread";
import { DocumentsPanel } from "@/components/documents-panel";
import type { EnrollmentStatus } from "@/db/schema/enums";

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

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; enrollmentId: string }>;
}) {
  const { clientId, enrollmentId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(
      `*,
       client:client_id (id, display_name),
       provider:provider_id (id, first_name, last_name, npi),
       group_entity:group_entity_id (id, legal_name),
       payer:payer_id (id, name, payer_type)`,
    )
    .eq("id", enrollmentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!enrollment) notFound();

  const client = Array.isArray(enrollment.client) ? enrollment.client[0] : enrollment.client;
  const provider = Array.isArray(enrollment.provider)
    ? enrollment.provider[0]
    : enrollment.provider;
  const groupEntity = Array.isArray(enrollment.group_entity)
    ? enrollment.group_entity[0]
    : enrollment.group_entity;
  const payer = Array.isArray(enrollment.payer) ? enrollment.payer[0] : enrollment.payer;

  const subjectLabel = provider
    ? `${provider.last_name}, ${provider.first_name}`
    : (groupEntity?.legal_name ?? "—");

  const status = enrollment.status as EnrollmentStatus;

  const [
    { data: history },
    { data: comments },
    { data: notes },
    { data: documents },
    { data: docCategories },
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
      .from("documents")
      .select(
        `id, file_name, category_id, size_bytes, mime_type, expiration_date, is_internal,
         virus_scan_status, created_at,
         category:category_id (id, name, label, is_default)`,
      )
      .eq("owner_type", "enrollment")
      .eq("owner_id", enrollmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("document_categories").select("id, name, label, is_default").order("sort_order"),
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
        title={`${payer?.name ?? "Unknown payer"} · ${enrollment.state} · Cycle ${enrollment.cycle_number}`}
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
          { label: "Clients", href: "/admin/clients" },
          { label: client?.display_name ?? "Client", href: `/admin/clients/${clientId}` },
          { label: "Enrollment" },
        ]}
        actions={
          <StatusTransitionDialog
            enrollmentId={enrollmentId}
            currentStatus={status}
            currentSubStatus={enrollment.sub_status ?? ""}
          />
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
            <span className="ml-auto label-sm">Pipeline</span>
          </div>
        </div>
        <div className="px-5 py-6">
          <StatusPipeline status={status} />
        </div>

        {(enrollment.effective_date ||
          enrollment.submitted_at ||
          enrollment.next_recred_due_date ||
          enrollment.denied_reason) ? (
          <dl className="grid gap-x-6 gap-y-3 border-t border-border-subtle px-5 py-4 text-[13px] md:grid-cols-3">
            {enrollment.submitted_at ? (
              <Meta label="Submitted" value={format(new Date(enrollment.submitted_at), "PP")} />
            ) : null}
            {enrollment.effective_date ? (
              <Meta label="Effective" value={format(new Date(enrollment.effective_date), "PP")} />
            ) : null}
            {enrollment.next_recred_due_date ? (
              <Meta
                label="Next recred"
                value={format(new Date(enrollment.next_recred_due_date), "PP")}
              />
            ) : null}
            {enrollment.denied_reason ? (
              <div className="md:col-span-3">
                <dt className="label-sm pb-1 text-danger">Denial reason</dt>
                <dd className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-charcoal">
                  {enrollment.denied_reason}
                </dd>
              </div>
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
          <TabsTrigger value="documents">
            Documents
            <span className="ml-1.5 rounded-full bg-lightgrey px-1.5 py-px text-[10px] font-semibold tnum text-navy/65">
              {documents?.length ?? 0}
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
              {!activity || activity.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-navy/55">No activity yet.</p>
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
                <h2 className="text-[15px] font-semibold text-navy">Cycle info</h2>
              </header>
              <dl className="space-y-4 px-5 py-5 text-[13px]">
                <Meta label="Cycle" value={`#${enrollment.cycle_number}`} />
                {enrollment.parent_enrollment_id ? (
                  <Meta
                    label="Parent enrollment"
                    value={
                      <span className="font-mono text-[11px] tnum text-navy/70">
                        {enrollment.parent_enrollment_id.slice(0, 8)}…
                      </span>
                    }
                  />
                ) : null}
                <Meta
                  label="Created"
                  value={format(new Date(enrollment.created_at), "PP")}
                />
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
                              {STATUS_LABEL[from]}
                            </span>
                            <ArrowRight size={12} className="text-navy/30" strokeWidth={1.6} />
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy">
                              {STATUS_LABEL[to]}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy/55">
                              Created
                            </span>
                            <ArrowRight size={12} className="text-navy/30" strokeWidth={1.6} />
                            <span className="font-semibold uppercase tracking-[0.06em] text-navy">
                              {STATUS_LABEL[to]}
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

        {/* Documents */}
        <TabsContent value="documents">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Documents</h2>
            </header>
            <div className="px-5 py-5">
              <DocumentsPanel
                clientId={clientId}
                ownerType="enrollment"
                ownerId={enrollmentId}
                documents={documents ?? []}
                categories={docCategories ?? []}
                canManage
                defaultCategoryName="payer_letter"
              />
            </div>
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
