import Link from "next/link";
import { format } from "date-fns";
import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_BADGE_VARIANT, pipelineDisplayOrder } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function ClientPortalDashboardPage() {
  const session = await requireClient();
  const supabase = await createSupabaseServerClient();

  // RLS enforces that we only see this client's data.
  const [{ data: settings }, { data: enrollments }] = await Promise.all([
    supabase
      .from("client_settings")
      .select("disclaimer_banner_text")
      .eq("client_id", session.clientId)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status, cycle_number, effective_date, next_recred_due_date,
         provider:provider_id (id, first_name, last_name),
         group_entity:group_entity_id (id, legal_name),
         payer:payer_id (id, name)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const counts = pipelineDisplayOrder().reduce(
    (acc, status) => {
      acc[status] = enrollments?.filter((e) => e.status === status).length ?? 0;
      return acc;
    },
    {} as Record<EnrollmentStatus, number>,
  );

  return (
    <div className="space-y-6">
      {settings?.disclaimer_banner_text && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {settings.disclaimer_banner_text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Credentialing status</h1>
        <Button asChild variant="outline">
          <Link href="/api/export/enrollments.xlsx">Export to Excel</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {pipelineDisplayOrder().map((status) => (
          <Card key={status}>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[status]}
              </p>
              <p className="text-2xl font-semibold">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {(!enrollments || enrollments.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No enrollments yet. Your credentialing team will populate this as work begins.
            </p>
          )}
          {enrollments && enrollments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Provider / Group</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium">Payer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Effective</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                    const groupEntity = Array.isArray(e.group_entity)
                      ? e.group_entity[0]
                      : e.group_entity;
                    const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                    const status = e.status as EnrollmentStatus;
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2">
                          {provider
                            ? `${provider.first_name} ${provider.last_name}`
                            : (groupEntity?.legal_name ?? "—")}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{e.state}</td>
                        <td className="px-3 py-2">{payer?.name ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_BADGE_VARIANT[status]}>
                            {STATUS_LABELS[status]}
                          </Badge>
                          {e.sub_status && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{e.sub_status}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {e.effective_date ? format(new Date(e.effective_date), "PP") : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/portal/enrollments/${e.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
