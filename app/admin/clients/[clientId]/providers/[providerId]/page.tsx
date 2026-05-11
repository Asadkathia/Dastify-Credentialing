import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, Circle, ClipboardList, Lock, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/hero-card";
import { SensitiveField } from "@/components/ui/sensitive-field";
import { StatusChip } from "@/components/ui/status-chip";
import { DocumentsPanel } from "@/components/documents-panel";
import { ProviderEditForm } from "./_components/provider-edit-form";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

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
           license_states, created_at,
           dea_number_encrypted, ssn_last4_encrypted, dob_encrypted`,
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

  const initials = `${(provider.first_name?.[0] ?? "").toUpperCase()}${
    (provider.last_name?.[0] ?? "").toUpperCase()
  }`;

  const licenseStates = Array.isArray(provider.license_states) ? provider.license_states : [];
  const enrollmentCount = enrollments?.length ?? 0;
  const approvedCount =
    enrollments?.filter((e) => e.status === "approved" || e.status === "completed").length ?? 0;

  // Profile completeness — 10 binary checks, 10% each.
  // Sensitive bytea fields are checked for presence only — values are never read here.
  const hasSensitive =
    Boolean(provider.dea_number_encrypted) ||
    Boolean(provider.ssn_last4_encrypted) ||
    Boolean(provider.dob_encrypted);
  const completeness: Array<{ label: string; done: boolean }> = [
    { label: "First name", done: Boolean(provider.first_name) },
    { label: "Last name", done: Boolean(provider.last_name) },
    { label: "Middle name", done: Boolean(provider.middle_name) },
    { label: "NPI", done: Boolean(provider.npi) },
    { label: "CAQH ID", done: Boolean(provider.caqh_id) },
    { label: "Primary specialty", done: Boolean(provider.primary_specialty) },
    { label: "Email", done: Boolean(provider.email) },
    { label: "Phone", done: Boolean(provider.phone) },
    { label: "At least one state license", done: licenseStates.length >= 1 },
    { label: "Sensitive identifiers on file", done: hasSensitive },
  ];
  const completenessDone = completeness.filter((c) => c.done).length;
  const completenessPct = completenessDone * 10;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[12px]">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-navy/55 hover:text-navy"
        >
          {client?.display_name ?? "Client"}
        </Link>
        <span className="text-navy/30">/</span>
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-navy/55 hover:text-navy"
        >
          Providers
        </Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/85">{displayName}</span>
      </nav>

      <HeroCard
        avatar={initials}
        avatarTone="teal"
        title={displayName}
        meta={
          <>
            <span className="inline-flex items-center rounded-sm bg-teal-08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal">
              Provider
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-navy/55">
              {provider.npi ? (
                <>
                  NPI <span className="font-mono tnum">{provider.npi}</span>
                </>
              ) : (
                "NPI not set"
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1B5E20]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
              Active
            </span>
          </>
        }
        stats={[
          { label: "Enrollments", value: enrollmentCount, tone: "teal" },
          { label: "State licenses", value: licenseStates.length },
          { label: "Approved", value: approvedCount, tone: "green" },
        ]}
        actions={
          <Button asChild>
            <Link href={`/admin/clients/${clientId}/enrollments/new`}>
              <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
              New enrollment
            </Link>
          </Button>
        }
        className="mb-6"
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
              {!provider.email && !provider.phone ? (
                <p className="text-navy/55">No contact info on file.</p>
              ) : null}
            </dl>
          </section>

          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">State licenses</h2>
              <span className="label-sm">{licenseStates.length}</span>
            </header>
            {licenseStates.length > 0 ? (
              <ul className="divide-y divide-border-subtle">
                {licenseStates.map(
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

          {/* Sensitive identifiers — admin can see presence; values stay locked at
              the UI layer (RLS already prevents client roles from reading the
              bytea). We don't decrypt or render values here per task constraint. */}
          <section className="surface">
            <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Sensitive identifiers</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-04 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy/65">
                <Lock size={10} strokeWidth={1.8} />
                Client view locked
              </span>
            </header>
            <div className="grid grid-cols-1 gap-4 px-5 py-5">
              <SensitiveField label="DEA" canReveal={false} mask="••••••••" />
              <SensitiveField label="SSN-last-4" canReveal={false} mask="••••" />
              <SensitiveField label="Date of birth" canReveal={false} mask="••••-••-••" />
            </div>
          </section>

          {/* Profile completeness — navy bg with teal accent stripe, mirrors the
              design in attachments/client-provider-detail.html. */}
          <section className="relative overflow-hidden rounded-md bg-navy shadow-[var(--shadow-xs)]">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-aqua to-teal/30"
            />
            <div className="px-5 py-5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                <ClipboardList size={13} strokeWidth={1.8} className="text-teal" />
                Profile Completeness
              </div>
              <div
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={completenessPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-teal transition-[width]"
                  style={{ width: `${completenessPct}%` }}
                />
              </div>
              <div className="mt-2.5 text-[12px] font-semibold text-teal tnum">
                {completenessPct}% complete
              </div>
              <ul className="mt-4 space-y-2">
                {completeness.map((c) => (
                  <li
                    key={c.label}
                    className={cn(
                      "flex items-center gap-2 text-[11px]",
                      c.done ? "text-white/80" : "text-white/40",
                    )}
                  >
                    {c.done ? (
                      <CheckCircle2
                        size={13}
                        strokeWidth={1.8}
                        className="shrink-0 text-success"
                      />
                    ) : (
                      <Circle size={13} strokeWidth={1.8} className="shrink-0 text-white/30" />
                    )}
                    <span className="truncate">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
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
