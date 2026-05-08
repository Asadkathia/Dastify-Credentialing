import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProviderAction } from "@/lib/actions/providers";

export default async function NewProviderPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  async function submit(formData: FormData) {
    "use server";
    const result = await createProviderAction(formData);
    if (!result.ok) {
      throw new Error(result.error);
    }
    redirect(`/admin/clients/${clientId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New provider</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submit} className="space-y-4">
            <input type="hidden" name="clientId" value={clientId} />

            <div className="grid grid-cols-2 gap-4">
              <Field id="firstName" label="First name" required />
              <Field id="lastName" label="Last name" required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field id="middleName" label="Middle" />
              <Field id="suffix" label="Suffix" />
              <Field id="npi" label="NPI" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field id="primarySpecialty" label="Primary specialty" />
              <Field id="secondarySpecialty" label="Secondary specialty" />
            </div>
            <Field id="caqhId" label="CAQH ID" />
            <div className="grid grid-cols-2 gap-4">
              <Field id="email" label="Email" type="email" />
              <Field id="phone" label="Phone" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <SubmitButton pendingLabel="Creating provider...">Create provider</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={id} name={id} type={type ?? "text"} required={required} />
    </div>
  );
}
