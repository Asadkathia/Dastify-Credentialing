import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { DocumentsPanel } from "@/components/documents-panel";
import { ProviderEditForm } from "./_components/provider-edit-form";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; providerId: string }>;
}) {
  const { clientId, providerId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: provider }, { data: enrollments }, { data: documents }, { data: docCategories }] =
    await Promise.all([
      supabase.from("clients").select("display_name").eq("id", clientId).maybeSingle(),
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
          `id, state, status, sub_status, effective_date,
           payer:payer_id (id, name)`,
        )
        .eq("provider_id", providerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select(
          `id, file_name, category_id, size_bytes, mime_type, expiration_date, is_internal,
           virus_scan_status, created_at,
           category:category_id (id, name, label, is_default)`,
        )
        .eq("owner_type", "provider")
        .eq("owner_id", providerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("document_categories")
        .select("id, name, label, is_default")
        .order("sort_order"),
    ]);

  if (!provider) notFound();

  const displayName =
    `${provider.last_name}, ${provider.first_name}` +
    (provider.middle_name ? ` ${provider.middle_name[0]}.` : "") +
    (provider.suffix ? `, ${provider.suffix}` : "");

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={
          <>
            {provider.primary_specialty ? (
              <span className="text-charcoal">{provider.primary_specialty}</span>
            ) : null}
            {provider.npi ? (
              <>
                {provider.primary_specialty ? " · " : ""}
                <span className="font-mono tnum">NPI {provider.npi}</span>
              </>
            ) : null}
          </>
        }
        crumbs={[
          { label: "Clients", href: "/admin" },
          { label: client?.display_name ?? "Client", href: `/admin/clients/${clientId}` },
          { label: displayName },
        ]}
        actions={
          <Button asChild>
            <Link href={`/admin/clients/${clientId}/enrollments/new`}>
              <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
              New enrollment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Edit form */}
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Provider details</h2>
            </header>
            <div className="px-5 py-5">
              <ProviderEditForm provider={provider} />
            </div>
          </section>

          {/* Enrollments */}
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Enrollments</h2>
              <span className="label-sm">{enrollments?.length ?? 0}</span>
            </header>
            {!enrollments || enrollments.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-navy/55">
                No enrollments yet.{" "}
                <Link
                  href={`/admin/clients/${clientId}/enrollments/new`}
                  className="font-semibold text-teal hover:text-[#0E7475]"
                >
                  Create one →
                </Link>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[60px]">State</th>
                      <th>Payer</th>
                      <th>Status</th>
                      <th>Effective</th>
                      <th className="w-[80px] text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => {
                      const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                      const status = e.status as EnrollmentStatus;
                      return (
                        <tr key={e.id}>
                          <td className="font-mono text-[12px] text-navy/70 tnum">{e.state}</td>
                          <td className="text-navy/85">{payer?.name ?? "—"}</td>
                          <td>
                            <StatusChip status={status} />
                            {e.sub_status ? (
                              <p className="mt-1 text-[11px] text-navy/55">{e.sub_status}</p>
                            ) : null}
                          </td>
                          <td className="tnum text-[12px] text-navy/70">
                            {e.effective_date ? format(new Date(e.effective_date), "PP") : "—"}
                          </td>
                          <td className="text-right">
                            <Link
                              href={`/admin/clients/${clientId}/enrollments/${e.id}`}
                              className="text-[12px] font-semibold uppercase tracking-wider text-teal hover:text-[#0E7475]"
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
          </section>

          {/* Documents */}
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Provider documents</h2>
              <span className="label-sm">{documents?.length ?? 0}</span>
            </header>
            <div className="px-5 py-5">
              <DocumentsPanel
                clientId={clientId}
                ownerType="provider"
                ownerId={providerId}
                documents={documents ?? []}
                categories={docCategories ?? []}
                canManage
                defaultCategoryName="license"
              />
            </div>
          </section>
        </div>

        {/* Side rail */}
        <aside className="space-y-6">
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Contact</h2>
            </header>
            <dl className="space-y-4 px-5 py-5 text-[13px]">
              {provider.email ? <Detail label="Email" value={provider.email} /> : null}
              {provider.phone ? <Detail label="Phone" value={provider.phone} /> : null}
              {provider.caqh_id ? (
                <Detail
                  label="CAQH ID"
                  value={<span className="font-mono tnum">{provider.caqh_id}</span>}
                />
              ) : null}
              {!provider.email && !provider.phone && !provider.caqh_id ? (
                <p className="text-navy/55">No contact info on file.</p>
              ) : null}
            </dl>
          </section>

          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">State licenses</h2>
              <span className="label-sm">
                {Array.isArray(provider.license_states) ? provider.license_states.length : 0}
              </span>
            </header>
            {Array.isArray(provider.license_states) && provider.license_states.length > 0 ? (
              <ul className="divide-y divide-border-subtle">
                {provider.license_states.map(
                  (
                    l: { state: string; licenseNumber: string; expiration: string | null },
                    i: number,
                  ) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-3 px-5 py-3 text-[13px]"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[12px] font-semibold tnum text-navy">
                          {l.state}
                        </span>
                        {l.licenseNumber ? (
                          <span className="ml-2 font-mono text-[11px] tnum text-navy/55">
                            {l.licenseNumber}
                          </span>
                        ) : null}
                      </div>
                      {l.expiration ? (
                        <span className="tnum text-[11px] text-navy/55">
                          exp {format(new Date(l.expiration), "PP")}
                        </span>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-[12px] text-navy/55">
                No state licenses recorded yet.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd className="mt-1 text-charcoal">{value}</dd>
    </div>
  );
}
