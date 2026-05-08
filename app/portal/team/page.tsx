import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamPage() {
  const session = await requireClient();
  if (session.role !== "client_admin") {
    redirect("/portal");
  }

  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("client_users")
    .select("id, email, full_name, role, is_active, invited_at, accepted_at")
    .eq("client_id", session.clientId)
    .order("invited_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage who from your practice has access to this portal. To invite a new team member,
          please contact your Dastify account manager.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{users?.length ?? 0} users</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{u.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">
                    {u.role === "client_admin" ? "Admin" : "Viewer"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.accepted_at
                      ? `Active since ${format(new Date(u.accepted_at), "PP")}`
                      : `Invited ${format(new Date(u.invited_at), "PP")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
