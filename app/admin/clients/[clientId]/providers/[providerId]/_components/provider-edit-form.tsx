"use client";
import { useState, useTransition } from "react";
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
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="First name" value={provider.first_name} />
          <Field label="Last name" value={provider.last_name} />
          <Field label="Middle" value={provider.middle_name} />
          <Field label="Suffix" value={provider.suffix} />
          <Field label="NPI" value={provider.npi} mono />
          <Field label="Primary specialty" value={provider.primary_specialty} />
          <Field label="Secondary specialty" value={provider.secondary_specialty} />
          <Field label="CAQH ID" value={provider.caqh_id} mono />
        </dl>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
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
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" name="firstName" defaultValue={provider.first_name} required />
        <Input label="Last name" name="lastName" defaultValue={provider.last_name} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Middle" name="middleName" defaultValue={provider.middle_name ?? ""} />
        <Input label="Suffix" name="suffix" defaultValue={provider.suffix ?? ""} />
        <Input label="NPI" name="npi" defaultValue={provider.npi ?? ""} placeholder="10 digits" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Primary specialty"
          name="primarySpecialty"
          defaultValue={provider.primary_specialty ?? ""}
        />
        <Input
          label="Secondary specialty"
          name="secondarySpecialty"
          defaultValue={provider.secondary_specialty ?? ""}
        />
      </div>
      <Input label="CAQH ID" name="caqhId" defaultValue={provider.caqh_id ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" name="email" type="email" defaultValue={provider.email ?? ""} />
        <Input label="Phone" name="phone" defaultValue={provider.phone ?? ""} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-green-700">{success}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
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
      </div>
    </form>
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm" : "text-sm"}>{value || "—"}</dd>
    </div>
  );
}

// Local helper that wraps ui/Input + Label for a labeled row.
function Input(props: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `pf-${props.name}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {props.label}
        {props.required && <span className="text-destructive"> *</span>}
      </Label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        placeholder={props.placeholder}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}
