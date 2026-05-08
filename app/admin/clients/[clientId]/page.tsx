import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/enrollment/state-machine";
import { InviteClientUserForm } from "./_components/invite-user-form";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: providers }, { data: enrollments }, { data: users }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
      supabase
        .from("providers")
        .select("id, first_name, last_name, npi, primary_specialty")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("last_name"),
      supabase
        .from("enrollments")
        .select(
          `id, state, status, sub_status, cycle_number,
           provider:provider_id (id, first_name, last_name),
           group_entity:group_entity_id (id, legal_name),
           payer:payer_id (id, name)`,
        )
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("client_users")
        .select("id, email, full_name, role, is_active, invited_at, accepted_at")
        .eq("client_id", clientId)
        .order("invited_at", { ascending: false }),
    ]);

  if (!client) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.display_name}</h1>
          <p className="text-sm text-muted-foreground">{client.legal_name}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${clientId}/providers/new`}>+ Provider</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/clients/${clientId}/enrollments/new`}>+ Enrollment</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            {(!enrollments || enrollments.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No enrollments yet. Add a provider, then create the first enrollment.
              </p>
            )}
            {enrollments && enrollments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Subject</th>
                      <th className="px-3 py-2 font-medium">State</th>
                      <th className="px-3 py-2 font-medium">Payer</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Cycle</th>
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
                      const subjectLabel = provider
                        ? `${provider.first_name} ${provider.last_name}`
                        : groupEntity?.legal_name ?? "—";
                      const status = e.status as EnrollmentStatus;
                      return (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2">{subjectLabel}</td>
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
                          <td className="px-3 py-2">{e.cycle_number}</td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/admin/clients/${clientId}/enrollments/${e.id}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Open →
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!providers || providers.length === 0) && (
                <p className="text-sm text-muted-foreground">No providers yet.</p>
              )}
              {providers?.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <Link
                    href={`/admin/clients/${clientId}/providers/${p.id}`}
                    className="hover:underline"
                  >
                    <span>
                      {p.last_name}, {p.first_name}
                      {p.primary_specialty && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.primary_specialty}
                        </span>
                      )}
                    </span>
                  </Link>
                  {p.npi && <span className="font-mono text-xs text-muted-foreground">{p.npi}</span>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portal users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {users && users.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {users.map((u) => (
                    <li key={u.id} className="flex justify-between">
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p>{u.role === "client_admin" ? "Admin" : "Viewer"}</p>
                        <p className="text-muted-foreground">
                          {u.accepted_at ? "Accepted" : "Invited"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No portal users invited yet.</p>
              )}
              <InviteClientUserForm clientId={clientId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
