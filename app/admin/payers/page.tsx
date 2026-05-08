import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PayersListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: payers } = await supabase
    .from("payers")
    .select("id, name, payer_type, recred_cycle_months, states_active")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payer master list</h1>
        <p className="text-sm text-muted-foreground">
          Global list of insurance payers. Used across all clients.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{payers?.length ?? 0} payers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Recred cycle</th>
                  <th className="px-3 py-2 font-medium">States</th>
                </tr>
              </thead>
              <tbody>
                {payers?.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{p.payer_type}</Badge>
                    </td>
                    <td className="px-3 py-2">{p.recred_cycle_months} months</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {Array.isArray(p.states_active)
                        ? p.states_active.length === 51
                          ? "All states"
                          : (p.states_active as string[]).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
