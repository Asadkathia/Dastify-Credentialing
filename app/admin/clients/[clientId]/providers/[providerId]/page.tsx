import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentsPanel } from "@/components/documents-panel";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/enrollment/state-machine";
import { ProviderEditForm } from "./_components/provider-edit-form";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; providerId: string }>;
}) {
  const { clientId, providerId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: provider }, { data: enrollments }, { data: documents }] = await Promise.all([
    supabase
      .from("providers")
      .select(
        `id, client_id, first_name, middle_name, last_name, suffix, npi,
         primary_specialty, secondary_specialty, caqh_id, email, phone,
         license_states, created_at`,
      )
      .eq("id", providerId)
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status, cycle_number, effective_date, next_recred_due_date,
         payer:payer_id (id, name)`,
      )
      .eq("provider_id", providerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select(
        "id, file_name, category, size_bytes, mime_type, expiration_date, is_internal, virus_scan_status, created_at",
      )
      .eq("owner_type", "provider")
      .eq("owner_id", providerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!provider) notFound();

  const fullName = [provider.first_name, provider.middle_name, provider.last_name, provider.suffix]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to client
        </Link>
        <div className="mt-1 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          {provider.npi && (
            <span className="font-mono text-sm text-muted-foreground">NPI {provider.npi}</span>
          )}
        </div>
        {provider.primary_specialty && (
          <p className="text-sm text-muted-foreground">{provider.primary_specialty}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Provider details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderEditForm provider={provider} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              {(!enrollments || enrollments.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No enrollments yet.{" "}
                  <Link
                    href={`/admin/clients/${clientId}/enrollments/new`}
                    className="text-primary hover:underline"
                  >
                    Create one
                  </Link>
                  .
                </p>
              )}
              {enrollments && enrollments.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">State</th>
                      <th className="px-3 py-2 font-medium">Payer</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Cycle</th>
                      <th className="px-3 py-2 font-medium">Effective</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => {
                      const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                      const status = e.status as EnrollmentStatus;
                      return (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{e.state}</td>
                          <td className="px-3 py-2">{payer?.name ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Badge variant={STATUS_BADGE_VARIANT[status]}>
                              {STATUS_LABELS[status]}
                            </Badge>
                            {e.sub_status && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {e.sub_status}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">{e.cycle_number}</td>
                          <td className="px-3 py-2 text-xs">
                            {e.effective_date ? format(new Date(e.effective_date), "PP") : "—"}
                          </td>
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Provider documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentsPanel
                clientId={clientId}
                ownerType="provider"
                ownerId={providerId}
                documents={documents ?? []}
                canManage
                defaultCategory="license"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {provider.email ? (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Email
                  </span>
                  <p>{provider.email}</p>
                </div>
              ) : null}
              {provider.phone ? (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Phone
                  </span>
                  <p>{provider.phone}</p>
                </div>
              ) : null}
              {provider.caqh_id ? (
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    CAQH ID
                  </span>
                  <p className="font-mono">{provider.caqh_id}</p>
                </div>
              ) : null}
              {!provider.email && !provider.phone && !provider.caqh_id && (
                <p className="text-muted-foreground">No contact info on file.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>State licenses</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(provider.license_states) && provider.license_states.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {provider.license_states.map(
                    (
                      l: { state: string; licenseNumber: string; expiration: string | null },
                      i: number,
                    ) => (
                      <li key={i} className="flex items-baseline justify-between">
                        <div>
                          <span className="font-mono font-semibold">{l.state}</span>
                          {l.licenseNumber && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {l.licenseNumber}
                            </span>
                          )}
                        </div>
                        {l.expiration && (
                          <span className="text-xs text-muted-foreground">
                            exp {format(new Date(l.expiration), "PP")}
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No state licenses recorded yet. Add via the License document upload (with
                  expiration) or extend the provider edit form.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild size="sm" className="w-full">
                <Link href={`/admin/clients/${clientId}/enrollments/new`}>
                  + New enrollment
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
