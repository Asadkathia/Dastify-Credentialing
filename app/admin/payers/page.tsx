import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";

const PAYER_TYPE_TINT: Record<string, string> = {
  commercial: "bg-teal-08 text-navy",
  medicare: "bg-navy-08 text-navy",
  medicaid: "bg-warning-08 text-[#7a4f00]",
  tricare: "bg-success-08 text-[#1B5E20]",
  other: "bg-lightgrey text-navy/65",
};

export default async function PayersListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: payers } = await supabase
    .from("payers")
    .select("id, name, payer_type, recred_cycle_months, states_active")
    .order("name");

  const count = payers?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Payer master list"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{count}</span> payers · global
            list, shared across all clients
          </>
        }
      />

      {count === 0 ? (
        <div className="surface p-10 text-center text-[13px] text-navy/55">
          No payers yet.
        </div>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="w-[120px]">Type</th>
                <th className="w-[140px]">Recred cycle</th>
                <th>States</th>
              </tr>
            </thead>
            <tbody>
              {payers!.map((p) => {
                const states = Array.isArray(p.states_active) ? (p.states_active as string[]) : [];
                const allStates = states.length === 51;
                const typeClass =
                  PAYER_TYPE_TINT[p.payer_type as string] ?? "bg-lightgrey text-navy/65";
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-navy">{p.name}</td>
                    <td>
                      <span
                        className={
                          "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                          typeClass
                        }
                      >
                        {p.payer_type}
                      </span>
                    </td>
                    <td className="tnum text-navy/70">{p.recred_cycle_months} months</td>
                    <td className="text-[12px] text-navy/65">
                      {allStates ? (
                        <span className="font-medium text-navy">All states</span>
                      ) : states.length === 0 ? (
                        "—"
                      ) : (
                        <span className="font-mono tnum">{states.join(", ")}</span>
                      )}
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
