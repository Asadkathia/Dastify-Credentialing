"use client";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateProviderAction } from "@/lib/actions/providers";

type Provider = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  npi: string | null;
  primary_specialty: string | null;
  secondary_specialty: string | null;
  caqh_id: string | null;
  email: string | null;
  phone: string | null;
};

export function ProviderEditForm({ provider }: { provider: Provider }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="First name" value={provider.first_name} />
          <Field label="Last name" value={provider.last_name} />
          <Field label="Middle name" value={provider.middle_name} />
          <Field label="Suffix" value={provider.suffix} />
          <Field label="NPI" value={provider.npi} mono />
          <Field label="CAQH ID" value={provider.caqh_id} mono />
          <Field label="Primary specialty" value={provider.primary_specialty} />
          <Field label="Secondary specialty" value={provider.secondary_specialty} />
        </dl>
        <div className="mt-5 flex justify-end border-t border-border-subtle pt-4">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil size={12} strokeWidth={1.6} className="mr-1.5" />
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        setError(null);
        setSuccess(null);
        formData.set("providerId", provider.id);
        startTransition(async () => {
          const result = await updateProviderAction(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            setSuccess("Saved.");
            setEditing(false);
          }
        });
      }}
    >
      <FieldGroup label="Name">
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="First name" name="firstName" defaultValue={provider.first_name} required />
          <FormInput label="Last name" name="lastName" defaultValue={provider.last_name} required />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <FormInput label="Middle name" name="middleName" defaultValue={provider.middle_name ?? ""} />
          <FormInput label="Suffix" name="suffix" defaultValue={provider.suffix ?? ""} />
        </div>
      </FieldGroup>

      <FieldGroup label="Identifiers">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="NPI"
            name="npi"
            defaultValue={provider.npi ?? ""}
            placeholder="10 digits"
            mono
          />
          <FormInput label="CAQH ID" name="caqhId" defaultValue={provider.caqh_id ?? ""} mono />
        </div>
      </FieldGroup>

      <FieldGroup label="Specialty">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Primary specialty"
            name="primarySpecialty"
            defaultValue={provider.primary_specialty ?? ""}
          />
          <FormInput
            label="Secondary specialty"
            name="secondarySpecialty"
            defaultValue={provider.secondary_specialty ?? ""}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Contact">
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Email" name="email" type="email" defaultValue={provider.email ?? ""} />
          <FormInput label="Phone" name="phone" defaultValue={provider.phone ?? ""} />
        </div>
      </FieldGroup>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-success/20 bg-success-08 px-3 py-2 text-[13px] text-[#1B5E20]">
          {success}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
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
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd
        className={
          "mt-1 text-[13px] " + (mono ? "font-mono tnum text-navy" : "text-charcoal")
        }
      >
        {value || <span className="text-navy/35">—</span>}
      </dd>
    </div>
  );
}

function FormInput(props: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
}) {
  const id = `pf-${props.name}`;
  return (
    <div>
      <Label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70"
      >
        {props.label}
        {props.required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        placeholder={props.placeholder}
        className={
          "mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] placeholder:text-navy/35 focus-visible:border-teal focus-visible:outline-none " +
          (props.mono ? "font-mono tnum" : "")
        }
      />
    </div>
  );
}
