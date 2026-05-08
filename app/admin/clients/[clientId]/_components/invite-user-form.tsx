"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteClientUserAction } from "@/lib/actions/clients";

export function InviteClientUserForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Invite user
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 border-t pt-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await inviteClientUserAction(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            setOpen(false);
          }
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-1">
        <Label htmlFor="invite-fullName" className="text-xs">
          Full name
        </Label>
        <Input id="invite-fullName" name="fullName" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input id="invite-email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-role" className="text-xs">
          Role
        </Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="client_viewer"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="client_viewer">Viewer (read + comment)</option>
          <option value="client_admin">Admin (manage users)</option>
        </select>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending..." : "Send invite"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
