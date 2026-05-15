"use client";
import { useState } from "react";
import Link from "next/link";
import type { OrganizationKind } from "@/db/schema/organizations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { createOrganizationAndRedirect } from "@/lib/actions/organizations";

export function NewOrganizationForm({ error }: { error?: string }) {
  const [kind, setKind] = useState<OrganizationKind>("group");

  return (
    <form
      action={createOrganizationAndRedirect}
      className="space-y-5 rounded-md border border-border-subtle bg-white p-6 shadow-[var(--shadow-xs)]"
    >
      <input type="hidden" name="kind" value={kind} />

      <fieldset>
        <legend className="label-sm pb-3">Organization type</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <KindOption
            value="group"
            label="Group practice"
            description="Multiple clinicians, shared organization."
            checked={kind === "group"}
            onSelect={() => setKind("group")}
          />
          <KindOption
            value="individual"
            label="Individual / solo"
            description="One clinician operating as their own practice."
            checked={kind === "individual"}
            onSelect={() => setKind("individual")}
          />
        </div>
      </fieldset>

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

      {kind === "individual" ? (
        <div className="border-t border-border-subtle pt-5">
          <p className="label-sm pb-1">Clinician details</p>
          <p className="pb-4 text-[12px] text-navy/55">
            Names are stored as first / middle / last / suffix per the data model.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field id="firstName" label="First name" required />
            <Field id="lastName" label="Last name" required />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field id="middleName" label="Middle name" />
            <Field id="suffix" label="Suffix" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field id="npi" label="NPI" />
            <Field id="caqhId" label="CAQH ID" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field id="primarySpecialty" label="Primary specialty" />
            <Field id="secondarySpecialty" label="Secondary specialty" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field id="email" label="Email" type="email" />
            <Field id="phone" label="Phone" />
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
        <Button asChild variant="ghost">
          <Link href="/admin/organizations">Cancel</Link>
        </Button>
        <SubmitButton pendingLabel="Creating organization…">
          Create organization
        </SubmitButton>
      </div>
    </form>
  );
}

function KindOption({
  value,
  label,
  description,
  checked,
  onSelect,
}: {
  value: OrganizationKind;
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-left transition-colors " +
        (checked
          ? "border-teal bg-teal-08"
          : "border-border-subtle bg-white hover:border-navy/30")
      }
    >
      <input
        type="radio"
        name="kindChoice"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 border-border-subtle text-teal focus:ring-teal"
      />
      <span className="flex flex-col">
        <span className="text-[13px] font-semibold text-navy">{label}</span>
        <span className="mt-0.5 text-[12px] text-navy/60">{description}</span>
      </span>
    </label>
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
