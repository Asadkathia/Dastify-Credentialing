import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { CommentsThread } from "@/app/admin/clients/[clientId]/enrollments/[enrollmentId]/_components/comments-thread";
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

export default async function ClientEnrollmentDetailPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS enforces tenant isolation; if the enrollment isn't for this client_id,
  // the query returns null and we 404.
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(
      `*,
       provider:provider_id (id, first_name, last_name),
       group_entity:group_entity_id (id, legal_name),
       payer:payer_id (id, name)`,
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) notFound();

  const provider = Array.isArray(enrollment.provider)
    ? enrollment.provider[0]
    : enrollment.provider;
  const groupEntity = Array.isArray(enrollment.group_entity)
    ? enrollment.group_entity[0]
    : enrollment.group_entity;
  const payer = Array.isArray(enrollment.payer) ? enrollment.payer[0] : enrollment.payer;
  const status = enrollment.status as EnrollmentStatus;

  const subjectLabel = provider
    ? `${provider.last_name}, ${provider.first_name}`
    : (groupEntity?.legal_name ?? "—");

  const [{ data: comments }, { data: history }, { data: documents }, { data: docCategories }] =
    await Promise.all([
      supabase
        .from("comments")
        .select("id, body, author_user_id, parent_comment_id, created_at")
        .eq("enrollment_id", enrollmentId)
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("status_history")
        .select("id, from_status, to_status, changed_at")
        .eq("enrollment_id", enrollmentId)
        .order("changed_at", { ascending: false })
        .limit(20),
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
    ]);

  return (
    <div>
      <PageHeader
        title={`${payer?.name ?? "Unknown payer"} · ${enrollment.state} · Cycle ${enrollment.cycle_number}`}
        subtitle={subjectLabel}
        crumbs={[{ label: "Dashboard", href: "/portal" }, { label: "Enrollment" }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status snapshot */}
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Status</h2>
            </header>
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-3">
                <StatusChip status={status} size="lg" />
                {enrollment.sub_status ? (
                  <span className="text-[13px] text-navy/65">{enrollment.sub_status}</span>
                ) : null}
              </div>
              {enrollment.effective_date ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border-subtle pt-4 text-[13px]">
                  <Meta
                    label="Effective"
                    value={format(new Date(enrollment.effective_date), "PP")}
                  />
                  {enrollment.next_recred_due_date ? (
                    <Meta
                      label="Next recred"
                      value={format(new Date(enrollment.next_recred_due_date), "PP")}
                    />
                  ) : null}
                </dl>
              ) : null}
            </div>
          </section>

          {/* Comments */}
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Comments</h2>
              <span className="label-sm">{comments?.length ?? 0}</span>
            </header>
            <div className="px-5 py-5">
              <CommentsThread enrollmentId={enrollmentId} comments={comments ?? []} allowPost />
            </div>
          </section>

          {/* Documents — RLS hides internal documents in client view */}
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Documents</h2>
              <span className="label-sm">{documents?.length ?? 0}</span>
            </header>
            <div className="px-5 py-5">
              <DocumentsPanel
                clientId={enrollment.client_id}
                ownerType="enrollment"
                ownerId={enrollmentId}
                documents={documents ?? []}
                categories={docCategories ?? []}
                canManage={false}
                defaultCategoryName="payer_letter"
              />
            </div>
          </section>
        </div>

        {/* Timeline — read-only */}
        <aside>
          <section className="surface sticky top-[88px]">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Timeline</h2>
              <span className="label-sm">{history?.length ?? 0}</span>
            </header>
            {!history || history.length === 0 ? (
              <p className="px-5 py-6 text-center text-[13px] text-navy/55">No activity yet.</p>
            ) : (
              <ol className="divide-y divide-border-subtle">
                {history.map((h) => {
                  const from = h.from_status as EnrollmentStatus | null;
                  const to = h.to_status as EnrollmentStatus;
                  return (
                    <li key={h.id} className="space-y-1.5 px-5 py-3.5">
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
                      </div>
                      <p className="tnum text-[11px] text-navy/55">
                        {format(new Date(h.changed_at), "PP · p")}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
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
