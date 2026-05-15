"use client";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOrganizationAction } from "@/lib/actions/organizations";
import type { OrganizationKind } from "@/db/schema/organizations";

type Client = {
  id: string;
  legal_name: string;
  display_name: string;
  kind: OrganizationKind;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
};

export function OrganizationEditForm({ client }: { client: Client }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kindLabel = client.kind === "individual" ? "Individual" : "Group";

  if (!editing) {
    return (
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-border-subtle bg-lightgrey/40 px-2.5 py-1 text-[11px]">
          <span className="label-sm">Kind</span>
          <span className="font-semibold uppercase tracking-[0.06em] text-navy/85">
            {kindLabel}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Legal name" value={client.legal_name} />
          <Field label="Display name" value={client.display_name} />
          <Field label="Contact name" value={client.primary_contact_name} />
          <Field label="Contact email" value={client.primary_contact_email} />
          <Field label="Contact phone" value={client.primary_contact_phone} />
          <Field label="Status" value={client.is_active ? "Active" : "Inactive"} />
          <div className="col-span-2">
            <Field label="Notes" value={client.notes} multiline />
          </div>
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
        formData.set("organizationId", client.id);
        startTransition(async () => {
          const result = await updateOrganizationAction(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            setSuccess("Saved.");
            setEditing(false);
          }
        });
      }}
    >
      <div className="inline-flex items-center gap-2 rounded-sm border border-border-subtle bg-lightgrey/40 px-2.5 py-1 text-[11px]">
        <span className="label-sm">Kind</span>
        <span className="font-semibold uppercase tracking-[0.06em] text-navy/85">
          {kindLabel}
        </span>
      </div>

      <FieldGroup label="Identity">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Legal name"
            name="legalName"
            defaultValue={client.legal_name}
            required
          />
          <FormInput
            label="Display name"
            name="displayName"
            defaultValue={client.display_name}
            required
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Primary contact">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Contact name"
            name="primaryContactName"
            defaultValue={client.primary_contact_name ?? ""}
          />
          <FormInput
            label="Contact email"
            name="primaryContactEmail"
            type="email"
            defaultValue={client.primary_contact_email ?? ""}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <FormInput
            label="Contact phone"
            name="primaryContactPhone"
            defaultValue={client.primary_contact_phone ?? ""}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Notes">
        <Label
          htmlFor="cf-notes"
          className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70"
        >
          Notes
        </Label>
        <Textarea
          id="cf-notes"
          name="notes"
          rows={4}
          defaultValue={client.notes ?? ""}
          className="mt-2 bg-white text-[13px]"
        />
      </FieldGroup>

      <FieldGroup label="Status">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-navy">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={client.is_active}
            className="h-4 w-4 rounded border-border-subtle text-teal focus:ring-teal"
          />
          <span>Client is active</span>
        </label>
        <p className="mt-1 text-[11px] text-navy/55">
          Inactive clients are hidden from default lists but data is retained.
        </p>
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
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd
        className={
          "mt-1 text-[13px] text-charcoal " + (multiline ? "whitespace-pre-wrap" : "")
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
}) {
  const id = `cf-${props.name}`;
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
        className="mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] placeholder:text-navy/35 focus-visible:border-teal focus-visible:outline-none"
      />
    </div>
  );
}
