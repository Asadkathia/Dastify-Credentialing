"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { transitionStatusAction } from "@/lib/actions/enrollments";
import {
  STATUS_LABELS,
  pipelineDisplayOrder,
} from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

const ALL_STATUSES: EnrollmentStatus[] = [
  ...pipelineDisplayOrder(),
  "closed",
  "withdrawn",
];

export function StatusTransitionForm({
  enrollmentId,
  currentStatus,
  currentSubStatus,
}: {
  enrollmentId: string;
  currentStatus: EnrollmentStatus;
  currentSubStatus: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 border-t pt-4"
      action={(formData) => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const result = await transitionStatusAction(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            setSuccess(`Status updated to ${STATUS_LABELS[result.data.toStatus]}`);
          }
        });
      }}
    >
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="toStatus" className="text-xs">
            New status
          </Label>
          <select
            id="toStatus"
            name="toStatus"
            defaultValue={currentStatus}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="subStatus" className="text-xs">
            Sub-status
          </Label>
          <Input
            id="subStatus"
            name="subStatus"
            defaultValue={currentSubStatus}
            placeholder="e.g. Awaiting CV"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="reason" className="text-xs">
          Reason (optional, included in history)
        </Label>
        <Textarea id="reason" name="reason" rows={2} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-green-700">{success}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Update status"}
      </Button>
    </form>
  );
}
