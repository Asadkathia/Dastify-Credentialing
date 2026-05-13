import Link from "next/link";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createClientAction } from "@/lib/actions/clients";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewProviderPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", organizationId)
    .maybeSingle();

  async function submit(formData: FormData) {
    "use server";
    const result = await createClientAction(formData);
    if (!result.ok) {
      throw new Error(result.error);
    }
    redirect(`/admin/organizations/${organizationId}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New provider"
        subtitle="Names are stored as first / middle / last / suffix per the data model."
        crumbs={[
          { label: "Clients", href: "/admin" },
          { label: client?.display_name ?? "Client", href: `/admin/organizations/${organizationId}` },
          { label: "New provider" },
        ]}
      />

      <form
        action={submit}
        className="space-y-6 rounded-md border border-border-subtle bg-white p-6 shadow-[var(--shadow-xs)]"
      >
        <input type="hidden" name="organizationId" value={organizationId} />

        <FieldGroup label="Name">
          <div className="grid grid-cols-2 gap-4">
            <Field id="firstName" label="First name" required />
            <Field id="lastName" label="Last name" required />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field id="middleName" label="Middle name" />
            <Field id="suffix" label="Suffix" />
          </div>
        </FieldGroup>

        <FieldGroup label="Identifiers">
          <div className="grid grid-cols-2 gap-4">
            <Field id="npi" label="NPI" />
            <Field id="caqhId" label="CAQH ID" />
          </div>
        </FieldGroup>

        <FieldGroup label="Specialty">
          <div className="grid grid-cols-2 gap-4">
            <Field id="primarySpecialty" label="Primary specialty" />
            <Field id="secondarySpecialty" label="Secondary specialty" />
          </div>
        </FieldGroup>

        <FieldGroup label="Contact">
          <div className="grid grid-cols-2 gap-4">
            <Field id="email" label="Email" type="email" />
            <Field id="phone" label="Phone" />
          </div>
        </FieldGroup>

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
          <Button asChild variant="ghost">
            <Link href={`/admin/organizations/${organizationId}`}>Cancel</Link>
          </Button>
          <SubmitButton pendingLabel="Creating provider…">Create provider</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-subtle pt-5 first:border-0 first:pt-0">
      <p className="label-sm pb-4">{label}</p>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  type,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70"
      >
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      <Input
        id={id}
        name={id}
        type={type ?? "text"}
        required={required}
        className="mt-2 bg-white text-[13px]"
      />
    </div>
  );
}
