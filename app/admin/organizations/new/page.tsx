import { PageHeader } from "@/components/ui/page-header";
import { NewOrganizationForm } from "./_components/new-organization-form";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New organization"
        subtitle="Add a practice Dastify will provide credentialing services to."
        crumbs={[
          { label: "Organizations", href: "/admin/organizations" },
          { label: "New" },
        ]}
      />

      <NewOrganizationForm error={params.error} />
    </div>
  );
}
