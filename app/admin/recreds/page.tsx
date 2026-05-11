import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { CalendarCheck2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const ninetyDaysAhead = () => {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().split("T")[0];
};

/**
 * "Overdue / At risk / Scheduled" are derived views (per CLAUDE.md anti-pattern
 * — they are not enum values). Thresholds:
 *   overdue:   due date is in the past
 *   at_risk:   due ≤ 30 days from now
 *   scheduled: due > 30 days from now
 */
function classifyDue(due: Date) {
  const days = differenceInCalendarDays(due, new Date());
  if (days < 0) return { kind: "overdue", days } as const;
  if (days <= 30) return { kind: "at_risk", days } as const;
  return { kind: "scheduled", days } as const;
}

const DUE_STYLE = {
  overdue: { bg: "bg-danger-08", dot: "bg-danger", text: "text-danger", label: "Overdue" },
  at_risk: { bg: "bg-warning-08", dot: "bg-warning", text: "text-[#7a4f00]", label: "At risk" },
  scheduled: { bg: "bg-teal-08", dot: "bg-teal", text: "text-navy", label: "Scheduled" },
} as const;

export default async function UpcomingRecredsPage() {
  const supabase = await createSupabaseServerClient();
  const cutoff = ninetyDaysAhead();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `id, client_id, state, status, next_recred_due_date, cycle_number,
       client:client_id (id, display_name),
       provider:provider_id (id, first_name, last_name),
       group_entity:group_entity_id (id, legal_name),
       payer:payer_id (id, name)`,
    )
    .eq("status", "effective")
    .not("next_recred_due_date", "is", null)
    .lte("next_recred_due_date", cutoff)
    .order("next_recred_due_date");

  const count = enrollments?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Upcoming recredentialing"
        subtitle={
          <>
            Effective enrollments due for recredentialing within the next 90 days.{" "}
            <span className="tnum font-semibold text-charcoal">{count}</span> total.
          </>
        }
      />

      {count === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 size={32} strokeWidth={1.4} />}
          title="No recreds due soon"
          description="Effective enrollments will appear here when their next recredentialing window opens within 90 days."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Subject</th>
                <th>Payer</th>
                <th className="w-[70px]">State</th>
                <th>Due</th>
                <th className="w-[130px]">Recred status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments!.map((e) => {
                const client = Array.isArray(e.client) ? e.client[0] : e.client;
                const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                const groupEntity = Array.isArray(e.group_entity)
                  ? e.group_entity[0]
                  : e.group_entity;
                const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                const subject = provider
                  ? `${provider.last_name}, ${provider.first_name}`
                  : (groupEntity?.legal_name ?? "—");
                const due = e.next_recred_due_date ? new Date(e.next_recred_due_date) : null;
                const cls = due ? classifyDue(due) : null;
                const styles = cls ? DUE_STYLE[cls.kind] : null;

                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        href={`/admin/clients/${e.client_id}`}
                        className="font-medium text-navy hover:text-teal"
                      >
                        {client?.display_name ?? "—"}
                      </Link>
                    </td>
                    <td className="text-navy/85">{subject}</td>
                    <td className="text-navy/70">{payer?.name ?? "—"}</td>
                    <td className="font-mono text-[12px] text-navy/70 tnum">{e.state}</td>
                    <td className="tnum text-navy/85">
                      {due ? (
                        <div>
                          <div>{format(due, "PP")}</div>
                          {cls ? (
                            <div className="text-[11px] text-navy/55">
                              {cls.days < 0
                                ? `${Math.abs(cls.days)} days overdue`
                                : `in ${cls.days} days`}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {styles ? (
                        <span
                          className={
                            "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                            styles.bg +
                            " " +
                            styles.text
                          }
                        >
                          <span aria-hidden className={"h-1.5 w-1.5 rounded-full " + styles.dot} />
                          {styles.label}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
