import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createClientAndRedirect } from "@/lib/actions/clients";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New client"
        subtitle="Add a practice Dastify will provide credentialing services to."
        crumbs={[{ label: "Clients", href: "/admin" }, { label: "New" }]}
      />

      <form
        action={createClientAndRedirect}
        className="space-y-5 rounded-md border border-border-subtle bg-white p-6 shadow-[var(--shadow-xs)]"
      >
        <Field id="legalName" label="Legal name" required />
        <Field id="displayName" label="Display name" required />

        <div className="border-t border-border-subtle pt-5">
          <p className="label-sm pb-4">Primary contact</p>
          <div className="space-y-5">
            <Field id="primaryContactName" label="Contact name" />
            <Field id="primaryContactEmail" label="Contact email" type="email" />
            <Field id="primaryContactPhone" label="Contact phone" />
          </div>
        </div>

        <div className="border-t border-border-subtle pt-5">
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            className="mt-2 bg-white text-[13px]"
          />
        </div>

        {params.error ? (
          <p
            className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
            role="alert"
          >
            {params.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
          <Button asChild variant="ghost">
            <Link href="/admin">Cancel</Link>
          </Button>
          <SubmitButton pendingLabel="Creating client…">Create client</SubmitButton>
        </div>
      </form>
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
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
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

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70"
    >
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </Label>
  );
}
