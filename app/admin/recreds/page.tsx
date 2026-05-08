import Link from "next/link";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ninetyDaysAhead = () => {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().split("T")[0];
};

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upcoming recredentialing</h1>
        <p className="text-sm text-muted-foreground">
          Effective enrollments due for recredentialing within the next 90 days.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{enrollments?.length ?? 0} due in 90 days</CardTitle>
        </CardHeader>
        <CardContent>
          {(!enrollments || enrollments.length === 0) && (
            <p className="text-sm text-muted-foreground">Nothing due soon.</p>
          )}
          {enrollments && enrollments.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">Payer</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => {
                  const client = Array.isArray(e.client) ? e.client[0] : e.client;
                  const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
                  const groupEntity = Array.isArray(e.group_entity)
                    ? e.group_entity[0]
                    : e.group_entity;
                  const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/clients/${e.client_id}`}
                          className="font-medium hover:underline"
                        >
                          {client?.display_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {provider
                          ? `${provider.first_name} ${provider.last_name}`
                          : (groupEntity?.legal_name ?? "—")}
                      </td>
                      <td className="px-3 py-2">{payer?.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.state}</td>
                      <td className="px-3 py-2 text-xs">
                        {e.next_recred_due_date &&
                          format(new Date(e.next_recred_due_date), "PP")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
