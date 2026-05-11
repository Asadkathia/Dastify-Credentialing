import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminClientsListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select(
      "id, display_name, legal_name, primary_contact_name, primary_contact_email, is_active, created_at",
    )
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  const count = clients?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{count}</span>{" "}
            {count === 1 ? "practice" : "practices"} Dastify provides credentialing services to.
          </>
        }
        actions={
          <Button asChild>
            <Link href="/admin/clients/new">
              <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
              New client
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load clients: {error.message}
        </div>
      ) : null}

      {!error && count === 0 ? (
        <EmptyState
          icon={<Building2 size={32} strokeWidth={1.4} />}
          title="No clients yet"
          description="Add the first practice Dastify provides credentialing services to. You can manage their providers, enrollments, and documents once they're set up."
          action={
            <Button asChild>
              <Link href="/admin/clients/new">
                <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
                New client
              </Link>
            </Button>
          }
        />
      ) : null}

      {!error && count > 0 ? (
        <div className="surface overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[28%]">Display name</th>
                <th>Legal name</th>
                <th>Primary contact</th>
                <th className="w-[110px]">Status</th>
                <th className="w-[80px] text-right" />
              </tr>
            </thead>
            <tbody>
              {clients!.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">
                    <Link href={`/admin/clients/${c.id}`} className="text-navy hover:text-teal">
                      {c.display_name}
                    </Link>
                  </td>
                  <td className="text-navy/60">{c.legal_name}</td>
                  <td className="text-navy/70">
                    {c.primary_contact_name || "—"}
                    {c.primary_contact_email ? (
                      <span className="block text-[11px] text-navy/45">
                        {c.primary_contact_email}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <StatusDot active={c.is_active} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-[12px] font-semibold uppercase tracking-wider text-teal hover:text-[#0E7475]"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={"h-1.5 w-1.5 rounded-full " + (active ? "bg-success" : "bg-grey")}
      />
      <span
        className={
          "text-[11px] font-semibold uppercase tracking-[0.06em] " +
          (active ? "text-[#1B5E20]" : "text-navy/50")
        }
      >
        {active ? "Active" : "Inactive"}
      </span>
    </span>
  );
}
