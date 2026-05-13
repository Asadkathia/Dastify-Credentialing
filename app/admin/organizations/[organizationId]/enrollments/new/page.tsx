import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { NewEnrollmentForm } from "./_components/new-enrollment-form";

export default async function NewEnrollmentPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: providers }, { data: groupEntities }, { data: payers }] =
    await Promise.all([
      supabase.from("organizations").select("display_name").eq("id", organizationId).maybeSingle(),
      supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("last_name"),
      supabase
        .from("group_entities")
        .select("id, legal_name")
        .eq("organization_id", organizationId)
        .is("deleted_at", null),
      supabase.from("payers").select("id, name").order("name"),
    ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New enrollment"
        subtitle="Pick a provider or group, then a payer + the states this enrollment covers. One row per state."
        crumbs={[
          { label: "Clients", href: "/admin" },
          { label: client?.display_name ?? "Client", href: `/admin/organizations/${organizationId}` },
          { label: "New enrollment" },
        ]}
      />

      <div className="rounded-md border border-border-subtle bg-white p-6 shadow-[var(--shadow-xs)]">
        <NewEnrollmentForm
          organizationId={organizationId}
          providers={providers ?? []}
          groupEntities={groupEntities ?? []}
          initialPayers={payers ?? []}
        />
      </div>
    </div>
  );
}
