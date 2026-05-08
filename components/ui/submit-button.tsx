"use client";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Wraps a regular Button with React 19's `useFormStatus` so it disables itself
 * (and shows pending text) while the parent <form>'s server action is in flight.
 *
 * Drop-in replacement for <Button type="submit"> inside any form that submits
 * to a server action. Prevents the double-submit problem where a user clicks
 * "Create" multiple times during a slow server round-trip.
 *
 * Usage:
 *   <SubmitButton pendingLabel="Creating...">Create client</SubmitButton>
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? (pendingLabel ?? "Working...") : children}
    </Button>
  );
}
