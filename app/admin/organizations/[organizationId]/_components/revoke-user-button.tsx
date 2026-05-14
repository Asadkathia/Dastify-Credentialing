"use client";
import { useState, useTransition } from "react";
import { UserX } from "lucide-react";
import { revokeOrganizationUserAction } from "@/lib/actions/organizations";

export function RevokeUserButton({
  organizationId,
  userId,
  email,
  wasPending,
}: {
  organizationId: string;
  userId: string;
  email: string;
  wasPending: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const verb = wasPending ? "Cancel invite" : "Revoke access";
  const prompt = wasPending
    ? `Cancel the pending invite for ${email}? They won't be able to use the invite link.`
    : `Revoke ${email}'s access to this organization? They'll be signed out and can no longer log in.`;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(prompt)) return;
          setError(null);
          startTransition(async () => {
            const fd = new FormData();
            fd.set("organizationId", organizationId);
            fd.set("userId", userId);
            const result = await revokeOrganizationUserAction(fd);
            if (!result.ok) setError(result.error);
          });
        }}
        className="inline-flex items-center gap-1 rounded-sm border border-danger/30 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-danger transition-colors hover:bg-danger-08 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserX size={11} strokeWidth={1.8} />
        {pending ? "Working…" : verb}
      </button>
      {error ? (
        <p role="alert" className="text-right text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
