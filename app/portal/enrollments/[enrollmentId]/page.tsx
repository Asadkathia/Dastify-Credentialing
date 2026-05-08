import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/enrollment/state-machine";
import { CommentsThread } from "@/app/admin/clients/[clientId]/enrollments/[enrollmentId]/_components/comments-thread";
import type { EnrollmentStatus } from "@/db/schema/enums";

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

  const [{ data: comments }, { data: history }] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-xs text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {payer?.name ?? "Unknown payer"}{" "}
          <span className="font-mono text-base text-muted-foreground">{enrollment.state}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {provider
            ? `${provider.first_name} ${provider.last_name}`
            : (groupEntity?.legal_name ?? "—")}{" "}
          · Cycle {enrollment.cycle_number}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant={STATUS_BADGE_VARIANT[status]} className="text-sm">
                  {STATUS_LABELS[status]}
                </Badge>
                {enrollment.sub_status && (
                  <span className="text-sm text-muted-foreground">{enrollment.sub_status}</span>
                )}
              </div>
              {enrollment.effective_date && (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Effective:</span>{" "}
                  {format(new Date(enrollment.effective_date), "PP")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsThread
                enrollmentId={enrollmentId}
                comments={comments ?? []}
                allowPost
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {(!history || history.length === 0) && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
            <ul className="space-y-2 text-xs">
              {history?.map((h) => (
                <li key={h.id}>
                  <p className="font-medium">
                    {h.from_status
                      ? `${STATUS_LABELS[h.from_status as EnrollmentStatus]} → ${STATUS_LABELS[h.to_status as EnrollmentStatus]}`
                      : `Created · ${STATUS_LABELS[h.to_status as EnrollmentStatus]}`}
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(h.changed_at), "PP p")}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
