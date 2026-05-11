import Link from "next/link";
import { format } from "date-fns";
import { Download, Info } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { pipelineDisplayOrder, STATUS_LABELS } from "@/lib/enrollment/state-machine";
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

  const pipelineOrder = pipelineDisplayOrder();
  const counts = pipelineOrder.reduce(
    (acc, status) => {
      acc[status] = enrollments?.filter((e) => e.status === status).length ?? 0;
      return acc;
    },
    {} as Record<EnrollmentStatus, number>,
  );

  const total = enrollments?.length ?? 0;

  return (
    <div>
      {/* Disclaimer banner — per CLAUDE.md rule 26 */}
      {settings?.disclaimer_banner_text ? (
        <div className="mb-6 flex items-start gap-3 rounded-md border-l-[3px] border-warning bg-warning-08 px-4 py-3 text-[13px] text-charcoal">
          <Info size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#7a4f00]" />
          <p>{settings.disclaimer_banner_text}</p>
        </div>
      ) : null}

      <PageHeader
        title="Credentialing status"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total enrollments
            across all providers, payers, and states.
          </>
        }
        actions={
          <Button asChild variant="outline">
            <a href="/api/export/enrollments.xlsx">
              <Download size={14} strokeWidth={1.6} className="mr-1.5" />
              Export to Excel
            </a>
          </Button>
        }
      />

      {/* KPI strip — pipeline stage counts */}
      <div className="mb-8 grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        {pipelineOrder.map((status) => (
          <div
            key={status}
            className="rounded-md border border-border-subtle bg-white px-4 py-3 shadow-[var(--shadow-xs)]"
          >
            <p className="label-sm">{STATUS_LABELS[status]}</p>
            <p className="mt-1.5 text-[24px] font-bold tnum tracking-[-0.01em] text-navy">
              {counts[status]}
            </p>
          </div>
        ))}
      </div>

      <section className="surface">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 className="text-[15px] font-semibold text-navy">All enrollments</h2>
          <span className="label-sm">{total} total</span>
        </header>

        {total === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-navy/55">
            No enrollments yet. Your credentialing team will populate this as work begins.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider / Group</th>
                  <th className="w-[60px]">State</th>
                  <th>Payer</th>
                  <th>Status</th>
                  <th>Effective</th>
                  <th className="w-[80px] text-right" />
                </tr>
              </thead>
              <tbody>
                {enrollments!.map((e) => {
                  const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                  const groupEntity = Array.isArray(e.group_entity)
                    ? e.group_entity[0]
                    : e.group_entity;
                  const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                  const status = e.status as EnrollmentStatus;
                  return (
                    <tr key={e.id}>
                      <td className="font-medium text-navy">
                        {provider
                          ? `${provider.last_name}, ${provider.first_name}`
                          : (groupEntity?.legal_name ?? "—")}
                      </td>
                      <td className="font-mono text-[12px] tnum text-navy/70">{e.state}</td>
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
  );
}
