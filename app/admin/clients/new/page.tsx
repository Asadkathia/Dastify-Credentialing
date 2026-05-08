import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClientAndRedirect } from "@/lib/actions/clients";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New client</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createClientAndRedirect} className="space-y-4">
            <Field id="legalName" label="Legal name" required />
            <Field id="displayName" label="Display name" required />
            <Field id="primaryContactName" label="Primary contact name" />
            <Field id="primaryContactEmail" label="Primary contact email" type="email" />
            <Field id="primaryContactPhone" label="Primary contact phone" />
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={4} />
            </div>
            {params.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {params.error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <SubmitButton pendingLabel="Creating client...">Create client</SubmitButton>
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
