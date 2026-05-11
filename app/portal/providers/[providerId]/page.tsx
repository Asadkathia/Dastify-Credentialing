import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { SensitiveField } from "@/components/ui/sensitive-field";
import type { EnrollmentStatus } from "@/db/schema/enums";

export default async function PortalProviderDetailPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  await requireClient();
  const { providerId } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS hides any other client's providers — null = 404, not "forbidden".
  const [{ data: provider }, { data: enrollments }] = await Promise.all([
    supabase
      .from("providers")
      .select(
        `id, first_name, middle_name, last_name, suffix, npi,
         primary_specialty, secondary_specialty, caqh_id, email, phone,
         license_states, created_at`,
      )
      .eq("id", providerId)
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
        crumbs={[{ label: "Providers", href: "/portal/providers" }, { label: displayName }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Read-only details */}
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Provider details</h2>
            </header>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5">
              <Detail label="First name" value={provider.first_name} />
              <Detail label="Last name" value={provider.last_name} />
              <Detail label="Middle name" value={provider.middle_name} />
              <Detail label="Suffix" value={provider.suffix} />
              <Detail
                label="NPI"
                value={provider.npi}
                mono
              />
              <Detail
                label="CAQH ID"
                value={provider.caqh_id}
                mono
              />
              <Detail label="Primary specialty" value={provider.primary_specialty} />
              <Detail label="Secondary specialty" value={provider.secondary_specialty} />
            </dl>
          </section>

          {/* Sensitive fields — locked in client view per CLAUDE.md rule 4 + 15.
              RLS won't return the encrypted bytea to client roles, so canReveal
              is fixed to false — this is the UI lock on top of the DB lock. */}
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Sensitive identifiers</h2>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-navy/55">
                Locked in client view — visible only to Dastify staff
              </p>
            </header>
            <div className="grid grid-cols-2 gap-4 px-5 py-5">
              <SensitiveField label="DEA" canReveal={false} mask="••••••••" />
              <SensitiveField label="SSN-last-4" canReveal={false} mask="••••" />
              <SensitiveField label="Date of birth" canReveal={false} mask="••••-••-••" />
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
                No enrollments yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[60px]">State</th>
                      <th>Payer</th>
                      <th>Status</th>
                      <th className="w-[60px]">Cycle</th>
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
                          <td className="font-mono text-[12px] tnum text-navy/70">{e.state}</td>
                          <td className="text-navy/85">{payer?.name ?? "—"}</td>
                          <td>
                            <StatusChip status={status} />
                            {e.sub_status ? (
                              <p className="mt-1 text-[11px] text-navy/55">{e.sub_status}</p>
                            ) : null}
                          </td>
                          <td className="tnum text-navy/70">{e.cycle_number}</td>
                          <td className="tnum text-[12px] text-navy/70">
                            {e.effective_date ? format(new Date(e.effective_date), "PP") : "—"}
                          </td>
                          <td className="text-right">
                            <Link
                              href={`/portal/enrollments/${e.id}`}
                              className="text-[12px] font-semibold uppercase tracking-wider text-teal hover:text-[#0E7475]"
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

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd
        className={
          "mt-1 text-[13px] " + (mono ? "font-mono tnum text-navy" : "text-charcoal")
        }
      >
        {value || <span className="text-navy/35">—</span>}
      </dd>
    </div>
  );
}
