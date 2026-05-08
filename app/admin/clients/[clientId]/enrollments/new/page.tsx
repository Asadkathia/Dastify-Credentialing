import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createEnrollmentAction } from "@/lib/actions/enrollments";

export default async function NewEnrollmentPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: providers }, { data: groupEntities }, { data: payers }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, first_name, last_name")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("group_entities")
      .select("id, legal_name")
      .eq("client_id", clientId)
      .is("deleted_at", null),
    supabase.from("payers").select("id, name").order("name"),
  ]);

  async function submit(formData: FormData) {
    "use server";
    const result = await createEnrollmentAction(formData);
    if (!result.ok) {
      throw new Error(result.error);
    }
    redirect(`/admin/clients/${clientId}/enrollments/${result.data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New enrollment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submit} className="space-y-4">
            <input type="hidden" name="clientId" value={clientId} />

            <div className="space-y-1.5">
              <Label htmlFor="providerId">Provider OR Group entity (one only)</Label>
              <select
                id="providerId"
                name="providerId"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                defaultValue=""
              >
                <option value="">— Select a provider —</option>
                {providers?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name}
                  </option>
                ))}
              </select>
            </div>

            {groupEntities && groupEntities.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="groupEntityId">Or group entity</Label>
                <select
                  id="groupEntityId"
                  name="groupEntityId"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  defaultValue=""
                >
                  <option value="">— No group enrollment —</option>
                  {groupEntities.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.legal_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="payerId">Payer *</Label>
                <select
                  id="payerId"
                  name="payerId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    — Select a payer —
                  </option>
                  {payers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State (2-letter) *</Label>
                <Input id="state" name="state" required maxLength={2} placeholder="TX" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cycleNumber">Cycle</Label>
                <Input id="cycleNumber" name="cycleNumber" type="number" min={1} defaultValue={1} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subStatus">Sub-status (optional)</Label>
                <Input id="subStatus" name="subStatus" placeholder="e.g. Awaiting CV" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton pendingLabel="Creating enrollment...">Create enrollment</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
