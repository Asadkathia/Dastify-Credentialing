import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, UserCircle2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/ui/hero-card";
import { StatusChip } from "@/components/ui/status-chip";
import { InviteClientUserForm } from "./_components/invite-user-form";
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
          `id, state, status, sub_status,
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

  const idShort = clientId.slice(0, 8).toUpperCase();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[12px]">
        <Link href="/admin/clients" className="text-navy/55 hover:text-navy">
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
              <Link href={`/admin/clients/${clientId}/providers/new`}>
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                Provider
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/admin/clients/${clientId}/enrollments/new`}>
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                Enrollment
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Enrollments — main column */}
        <section className="lg:col-span-2">
          <div className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Enrollments</h2>
              <span className="label-sm">{enrollments?.length ?? 0} total</span>
            </header>

            {!enrollments || enrollments.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-navy/55">
                No enrollments yet. Add a provider, then create the first enrollment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="w-[60px]">State</th>
                      <th>Payer</th>
                      <th>Status</th>
                      <th className="w-[60px] text-right" />
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
                        ? `${provider.last_name}, ${provider.first_name}`
                        : (groupEntity?.legal_name ?? "—");
                      const status = e.status as EnrollmentStatus;
                      return (
                        <tr key={e.id}>
                          <td className="font-medium text-navy">{subjectLabel}</td>
                          <td className="font-mono text-[12px] text-navy/70 tnum">{e.state}</td>
                          <td className="text-navy/70">{payer?.name ?? "—"}</td>
                          <td>
                            <StatusChip status={status} />
                            {e.sub_status ? (
                              <p className="mt-1 text-[11px] text-navy/55">{e.sub_status}</p>
                            ) : null}
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
          </div>
        </section>

        {/* Side rail — providers + portal users */}
        <aside className="space-y-6">
          <div className="surface">
            <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-navy">Providers</h2>
              <span className="label-sm">{providers?.length ?? 0}</span>
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
                    href={`/admin/clients/${clientId}/providers/${p.id}`}
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
              <span className="label-sm">{users?.length ?? 0}</span>
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
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70">
                          {u.role === "client_admin" ? "Admin" : "Viewer"}
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
                <InviteClientUserForm clientId={clientId} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
