import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireOrganization } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";

export default async function TeamPage() {
  const session = await requireOrganization();
  if (session.role !== "org_admin") {
    redirect("/portal");
  }

  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("organization_users")
    .select("id, email, full_name, role, is_active, invited_at, accepted_at")
    .eq("organization_id", session.organizationId)
    .order("invited_at", { ascending: false });

  const count = users?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Manage who from your practice has access to this portal. To invite a new team member, please contact your Dastify account manager."
      />

      <section className="surface">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 className="text-[15px] font-semibold text-navy">Users</h2>
          <span className="label-sm">{count} total</span>
        </header>

        {count === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-navy/55">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th className="w-[100px]">Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users!.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-navy">{u.full_name}</td>
                    <td className="text-navy/70">{u.email}</td>
                    <td>
                      <span
                        className={
                          "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                          (u.role === "org_admin"
                            ? "bg-teal-08 text-navy"
                            : "bg-lightgrey text-navy/65")
                        }
                      >
                        {u.role === "org_admin" ? "Admin" : "Viewer"}
                      </span>
                    </td>
                    <td className="tnum text-[12px] text-navy/65">
                      {u.accepted_at
                        ? `Active since ${format(new Date(u.accepted_at), "PP")}`
                        : `Invited ${format(new Date(u.invited_at), "PP")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
