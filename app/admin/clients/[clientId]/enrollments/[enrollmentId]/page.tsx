import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/enrollment/state-machine";
import { StatusTransitionForm } from "./_components/status-transition-form";
import { CommentsThread } from "./_components/comments-thread";
import { InternalNotesThread } from "./_components/internal-notes-thread";
import { DocumentsPanel } from "@/components/documents-panel";
import type { EnrollmentStatus } from "@/db/schema/enums";

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
       provider:provider_id (id, first_name, last_name, npi),
       group_entity:group_entity_id (id, legal_name),
       payer:payer_id (id, name, payer_type)`,
    )
    .eq("id", enrollmentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!enrollment) notFound();

  const provider = Array.isArray(enrollment.provider)
    ? enrollment.provider[0]
    : enrollment.provider;
  const groupEntity = Array.isArray(enrollment.group_entity)
    ? enrollment.group_entity[0]
    : enrollment.group_entity;
  const payer = Array.isArray(enrollment.payer) ? enrollment.payer[0] : enrollment.payer;

  const subjectLabel = provider
    ? `${provider.first_name} ${provider.last_name}${provider.npi ? ` · NPI ${provider.npi}` : ""}`
    : (groupEntity?.legal_name ?? "—");

  const status = enrollment.status as EnrollmentStatus;

  const [{ data: history }, { data: comments }, { data: notes }, { data: documents }] =
    await Promise.all([
      supabase
        .from("status_history")
        .select("id, from_status, to_status, from_sub_status, to_sub_status, reason, changed_by_user_id, changed_at")
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
          "id, file_name, category, size_bytes, mime_type, expiration_date, is_internal, virus_scan_status, created_at",
        )
        .eq("owner_type", "enrollment")
        .eq("owner_id", enrollmentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to client
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {payer?.name ?? "Unknown payer"}{" "}
          <span className="font-mono text-base text-muted-foreground">{enrollment.state}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {subjectLabel} · Cycle {enrollment.cycle_number}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant={STATUS_BADGE_VARIANT[status]} className="text-sm">
                  {STATUS_LABELS[status]}
                </Badge>
                {enrollment.sub_status && (
                  <span className="text-sm text-muted-foreground">{enrollment.sub_status}</span>
                )}
              </div>
              {enrollment.effective_date && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Effective:</span>{" "}
                  {format(new Date(enrollment.effective_date), "PP")}
                  {enrollment.next_recred_due_date && (
                    <>
                      <span className="ml-3 text-muted-foreground">Recred due:</span>{" "}
                      {format(new Date(enrollment.next_recred_due_date), "PP")}
                    </>
                  )}
                </div>
              )}
              {enrollment.submitted_at && (
                <p className="text-xs text-muted-foreground">
                  Submitted {format(new Date(enrollment.submitted_at), "PPp")}
                </p>
              )}
              <StatusTransitionForm
                enrollmentId={enrollmentId}
                currentStatus={status}
                currentSubStatus={enrollment.sub_status ?? ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client-visible comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsThread
                enrollmentId={enrollmentId}
                comments={comments ?? []}
                allowPost
              />
            </CardContent>
          </Card>

          <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
            <CardHeader>
              <CardTitle>Internal notes (admin-only)</CardTitle>
            </CardHeader>
            <CardContent>
              <InternalNotesThread enrollmentId={enrollmentId} notes={notes ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentsPanel
                clientId={clientId}
                ownerType="enrollment"
                ownerId={enrollmentId}
                documents={documents ?? []}
                canManage
                defaultCategory="payer_letter"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              {(!history || history.length === 0) && (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              )}
              <ul className="space-y-3">
                {history?.map((h) => (
                  <li key={h.id} className="text-xs">
                    <p className="font-medium">
                      {h.from_status
                        ? `${STATUS_LABELS[h.from_status as EnrollmentStatus]} → ${STATUS_LABELS[h.to_status as EnrollmentStatus]}`
                        : `Created · ${STATUS_LABELS[h.to_status as EnrollmentStatus]}`}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(h.changed_at), "PP p")}
                    </p>
                    {h.reason && <p className="mt-0.5 italic text-muted-foreground">{h.reason}</p>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
