import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Info,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/hero-card";
import { MiniPipeline } from "@/components/ui/mini-pipeline";
import { PayerMark } from "@/components/ui/payer-mark";
import { SensitiveField } from "@/components/ui/sensitive-field";
import { StatusChip } from "@/components/ui/status-chip";
import { ClientEditForm } from "./_components/client-edit-form";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; clientId: string }>;
}) {
  const { organizationId, clientId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: provider }, { data: enrollments }] = await Promise.all([
    supabase.from("organizations").select("display_name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("clients")
      .select(
        `id, organization_id, first_name, middle_name, last_name, suffix, npi,
         primary_specialty, secondary_specialty, caqh_id, email, phone,
         license_states, created_at,
         dea_number_encrypted, ssn_last4_encrypted, dob_encrypted`,
      )
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status, effective_date,
         payer:payer_id (id, name)`,
      )
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
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
    enrollments?.filter((e) => e.status === "approved").length ?? 0;

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
          href={`/admin/organizations/${organizationId}`}
          className="text-navy/55 hover:text-navy"
        >
          {client?.display_name ?? "Client"}
        </Link>
        <span className="text-navy/30">/</span>
        <Link
          href={`/admin/organizations/${organizationId}`}
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
            <Link href={`/admin/organizations/${organizationId}/enrollments/new`}>
              <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
              New enrollment
            </Link>
          </Button>
        }
        className="mb-6"
      />

      {/* Profile completeness — promoted to a full-width banner directly below the
          hero so the score is visible without scrolling. Navy card with teal
          accent stripe matches the original sidebar treatment; checklist is laid
          out horizontally to fit the wider container. */}
      <section className="relative mb-6 overflow-hidden rounded-md bg-navy shadow-[var(--shadow-xs)]">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-aqua to-teal/30"
        />
        <div className="px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              <ClipboardList size={13} strokeWidth={1.8} className="text-teal" />
              Profile Completeness
            </div>
            <div className="text-[12px] font-semibold text-teal tnum">
              {completenessPct}% complete
            </div>
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
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Edit form */}
          <section className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Provider details</h2>
            </header>
            <div className="px-5 py-5">
              <ClientEditForm provider={provider} />
            </div>
          </section>

          {/* Enrollments — card-row pattern with inline mini-pipeline. */}
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-navy">Enrollments</h2>
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-teal-12 px-1.5 text-[11px] font-semibold text-teal tnum">
                  {enrollments?.length ?? 0}
                </span>
              </div>
              <Link
                href={`/admin/organizations/${organizationId}/enrollments/new`}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
              >
                + New
              </Link>
            </header>
            {!enrollments || enrollments.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-navy/55">
                No enrollments yet.{" "}
                <Link
                  href={`/admin/organizations/${organizationId}/enrollments/new`}
                  className="font-semibold text-teal hover:text-[#0E7475]"
                >
                  Create one →
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {enrollments.map((e) => {
                  const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                  const status = e.status as EnrollmentStatus;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/admin/organizations/${organizationId}/enrollments/${e.id}`}
                        className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-navy-04"
                      >
                        <PayerMark name={payer?.name ?? "??"} size={30} />
                        <span className="inline-flex h-[22px] items-center rounded-md bg-navy-04 px-2 font-mono text-[11px] font-semibold tnum text-navy/75">
                          {e.state}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-navy">
                          {payer?.name ?? "Payer"}
                        </span>
                        <MiniPipeline status={status} className="hidden md:inline-flex" />
                        <StatusChip status={status} />
                        <ChevronRight
                          size={16}
                          strokeWidth={1.6}
                          className="shrink-0 text-navy/30 transition-transform group-hover:translate-x-0.5 group-hover:text-navy/55"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

        </div>

        {/* Side rail */}
        <aside className="space-y-6">
          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Contact</h2>
              <button
                type="button"
                aria-label="Edit contact"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border-subtle px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/65 transition-colors hover:border-teal hover:text-teal"
              >
                <Pencil size={11} strokeWidth={1.8} />
                Edit
              </button>
            </header>
            <ul className="divide-y divide-border-subtle">
              {provider.email ? (
                <ContactRow
                  icon={<Mail size={15} strokeWidth={1.7} />}
                  iconTone="teal"
                  label="Email"
                  value={provider.email}
                  href={`mailto:${provider.email}`}
                />
              ) : null}
              {provider.phone ? (
                <ContactRow
                  icon={<Phone size={15} strokeWidth={1.7} />}
                  iconTone="navy"
                  label="Phone"
                  value={provider.phone}
                  href={`tel:${provider.phone}`}
                />
              ) : null}
              {!provider.email && !provider.phone ? (
                <li className="px-5 py-5 text-[13px] text-navy/55">No contact info on file.</li>
              ) : null}
            </ul>
          </section>

          <section className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-navy">State licenses</h2>
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-teal-12 px-1.5 text-[11px] font-semibold text-teal tnum">
                  {licenseStates.length}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border-subtle px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy/65 transition-colors hover:border-teal hover:text-teal"
              >
                <Plus size={11} strokeWidth={1.9} />
                Add
              </button>
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
            <div className="px-5 pt-4">
              <div className="flex items-start gap-2 rounded-md bg-teal-08 px-3 py-2.5 text-[12px] leading-snug text-navy/80">
                <Info size={14} strokeWidth={1.7} className="mt-px shrink-0 text-teal" />
                <p>
                  These fields are encrypted and visible only to Dastify staff. They are used for
                  credentialing purposes only.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 px-5 pt-4 pb-5 sm:grid-cols-2">
              <SensitiveField label="DEA" canReveal={false} mask="••••••••" />
              <SensitiveField label="SSN-last-4" canReveal={false} mask="••••" />
              <div className="sm:col-span-2">
                <SensitiveField label="Date of birth" canReveal={false} mask="••••-••-••" />
              </div>
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  iconTone,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  iconTone: "teal" | "navy";
  label: string;
  value: string;
  href?: string;
}) {
  const toneClass =
    iconTone === "teal" ? "bg-teal-08 text-teal" : "bg-navy-04 text-navy";
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy/45">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            className="block truncate text-[14px] font-medium text-teal hover:text-[#0E7475]"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-[14px] text-charcoal">{value}</p>
        )}
      </div>
    </li>
  );
}
