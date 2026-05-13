import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ChevronRight,
  Eye,
  FileText,
  MessageSquare,
  Plus,
  RefreshCw,
  Shield,
  UserCircle2,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/hero-card";
import { MiniPipeline } from "@/components/ui/mini-pipeline";
import { PayerMark } from "@/components/ui/payer-mark";
import { StatusChip } from "@/components/ui/status-chip";
import { OrganizationEditForm } from "./_components/organization-edit-form";
import { InviteOrganizationUserForm } from "./_components/invite-user-form";
import type { EnrollmentStatus } from "@/db/schema/enums";

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  const first = parts[0];
  if (!first) return "—";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

function ActivePill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1B5E20]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#1B5E20]" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy/55">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-navy/40" />
      Inactive
    </span>
  );
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: client },
    { data: providers },
    { data: enrollments },
    { data: users },
    { data: activity },
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supabase
      .from("clients")
      .select("id, first_name, last_name, npi, primary_specialty")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status,
         provider:client_id (id, first_name, last_name),
         group_entity:group_entity_id (id, legal_name),
         payer:payer_id (id, name)`,
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("organization_users")
      .select("id, email, full_name, role, is_active, invited_at, accepted_at")
      .eq("organization_id", organizationId)
      .order("invited_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("id, action, target_table, summary, occurred_at")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(8),
  ]);

  if (!client) notFound();

  const idShort = organizationId.slice(0, 8).toUpperCase();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[12px]">
        <Link href="/admin/organizations" className="text-navy/55 hover:text-navy">
          Clients
        </Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/85">{client.display_name}</span>
      </nav>

      <HeroCard
        className="mb-6"
        avatar={initials(client.display_name)}
        avatarTone="teal"
        title={client.display_name}
        meta={
          <>
            {client.legal_name ? <span>{client.legal_name}</span> : null}
            {client.legal_name ? <span className="text-navy/30">·</span> : null}
            <span className="font-mono tnum">#CLT-{idShort}</span>
            <span className="text-navy/30">·</span>
            <ActivePill active={Boolean(client.is_active)} />
          </>
        }
        stats={[
          { label: "ENROLLMENTS", value: enrollments?.length ?? 0 },
          { label: "PROVIDERS", value: providers?.length ?? 0 },
          { label: "PORTAL USERS", value: users?.length ?? 0 },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/admin/organizations/${organizationId}/providers/new`}>
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                Provider
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/admin/organizations/${organizationId}/enrollments/new`}>
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                Enrollment
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT (primary) — Enrollments + Recent Activity */}
        <section className="space-y-6 lg:col-span-2">
          <div className="surface">
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
              <p className="px-5 py-10 text-center text-[13px] text-navy/55">
                No enrollments yet. Add a provider, then create the first enrollment.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {enrollments.map((e) => {
                  const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                  const groupEntity = Array.isArray(e.group_entity)
                    ? e.group_entity[0]
                    : e.group_entity;
                  const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                  const subjectLabel = provider
                    ? `${provider.last_name}, ${provider.first_name}`
                    : (groupEntity?.legal_name ?? "—");
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
                          {subjectLabel}
                          <span className="ml-1.5 text-navy/45">· {payer?.name ?? "—"}</span>
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
          </div>

          {/* RECENT ACTIVITY section divider + audit-trail card */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <p className="label-sm">Recent Activity</p>
              <span aria-hidden className="flex-1 border-t border-border-subtle" />
            </div>
            <div className="surface">
              <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h2 className="text-[15px] font-semibold text-navy">Audit trail</h2>
                <Link
                  href={`/admin/audit?client=${organizationId}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
                >
                  View all →
                </Link>
              </header>
              {!activity || activity.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-navy/55">
                  No activity recorded yet.
                </p>
              ) : (
                <ul className="relative px-5 py-5">
                  <span
                    aria-hidden
                    className="absolute left-[26px] top-7 bottom-7 w-px bg-border-subtle"
                  />
                  {activity.map((a) => {
                    const tone = activityTone(a.action);
                    return (
                      <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                        <span
                          aria-hidden
                          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          <tone.Icon size={12} strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[13px] text-charcoal">
                            {a.summary ?? formatAction(a.action, a.target_table)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-navy/55">
                            {formatDistanceToNow(new Date(a.occurred_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT rail — Providers + Portal users + Client details */}
        <aside className="space-y-6">
          <div className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-navy">Providers</h2>
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-teal-12 px-1.5 text-[11px] font-semibold text-teal tnum">
                  {providers?.length ?? 0}
                </span>
              </div>
              <Link
                href={`/admin/organizations/${organizationId}/providers/new`}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
              >
                + New
              </Link>
            </header>
            <div className="divide-y divide-border-subtle">
              {!providers || providers.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-navy/55">
                  No providers yet.
                </p>
              ) : (
                providers.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/organizations/${organizationId}/providers/${p.id}`}
                    className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-navy-04"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-08 text-teal"
                    >
                      <UserCircle2 size={14} strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-navy">
                        {p.last_name}, {p.first_name}
                      </p>
                      {p.primary_specialty ? (
                        <p className="text-[11px] text-navy/55">{p.primary_specialty}</p>
                      ) : null}
                    </div>
                    {p.npi ? (
                      <span className="font-mono text-[11px] text-navy/45 tnum">{p.npi}</span>
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Portal users</h2>
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-teal-12 px-1.5 text-[11px] font-semibold text-teal tnum">
                {users?.length ?? 0}
              </span>
            </header>
            <div className="px-5 py-4">
              {users && users.length > 0 ? (
                <ul className="space-y-3 pb-4">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-navy">
                          {u.full_name}
                        </p>
                        <p className="truncate text-[11px] text-navy/55">{u.email}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70">
                          {u.role === "org_admin" ? (
                            <Shield size={11} strokeWidth={1.8} />
                          ) : (
                            <Eye size={11} strokeWidth={1.8} />
                          )}
                          {u.role === "org_admin" ? "Admin" : "Viewer"}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.06em] text-navy/45">
                          {u.accepted_at ? "Accepted" : "Invited"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pb-4 text-center text-[13px] text-navy/55">
                  No portal users invited yet.
                </p>
              )}
              <div className="border-t border-border-subtle pt-4">
                <InviteOrganizationUserForm organizationId={organizationId} />
              </div>
            </div>
          </div>

          <div className="surface">
            <header className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Client details</h2>
            </header>
            <div className="px-5 py-5">
              <OrganizationEditForm client={client} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function activityTone(action: string): {
  bg: string;
  fg: string;
  Icon: typeof Activity;
} {
  if (action === "create" || action === "invite") {
    return { bg: "rgba(46,125,50,0.10)", fg: "#1B5E20", Icon: FileText };
  }
  if (action === "status_change" || action === "update") {
    return { bg: "rgba(22,193,194,0.10)", fg: "#0E7475", Icon: RefreshCw };
  }
  if (action === "comment") {
    return { bg: "rgba(78,206,209,0.12)", fg: "#0E7475", Icon: MessageSquare };
  }
  return { bg: "rgba(14,20,60,0.06)", fg: "#0E143C", Icon: Activity };
}

function formatAction(action: string, table: string): string {
  const pretty = action.replace(/_/g, " ");
  return `${pretty} on ${table}`;
}
