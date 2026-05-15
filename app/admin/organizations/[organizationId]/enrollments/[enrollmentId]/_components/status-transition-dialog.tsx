"use client";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/ui/status-chip";
import { transitionStatusAction } from "@/lib/actions/enrollments";
import { STATUS_LABELS, pipelineDisplayOrder } from "@/lib/enrollment/state-machine";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@/db/schema/enums";

// All 6 enum values, with the linear path first and the off-rail terminal last.
const ALL_STATUSES: EnrollmentStatus[] = [
  ...pipelineDisplayOrder(),
  ...ENROLLMENT_STATUSES.filter((s) => !pipelineDisplayOrder().includes(s)),
];

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";
const selectClasses =
  "mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal focus-visible:border-teal focus-visible:outline-none";
const inputClasses = "mt-2 bg-white text-[13px]";

export type StatusTransitionTriggerVariant = "default" | "quick-action";

export function StatusTransitionDialog({
  enrollmentId,
  currentStatus,
  currentSubStatus,
  triggerLabel,
  triggerVariant = "default",
}: {
  enrollmentId: string;
  currentStatus: EnrollmentStatus;
  currentSubStatus: string;
  triggerLabel?: string;
  triggerVariant?: StatusTransitionTriggerVariant;
}) {
  const [open, setOpen] = useState(false);
  const [toStatus, setToStatus] = useState<EnrollmentStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOffRail = toStatus === "non_par_credentialed";

  const isQuickAction = triggerVariant === "quick-action";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isQuickAction ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-teal px-3 py-2 text-[12px] font-semibold text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
          >
            {triggerLabel ?? "Transition status"}
            <ArrowRight size={12} strokeWidth={1.8} />
          </button>
        ) : (
          <Button size="sm">
            <ArrowRight size={12} strokeWidth={1.6} className="mr-1.5" />
            {triggerLabel ?? "Transition status"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transition status</DialogTitle>
          <DialogDescription>
            Server validates the transition against the state machine. The change is recorded in
            status history (append-only).
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          action={(formData) => {
            setError(null);
            formData.set("enrollmentId", enrollmentId);
            formData.set("toStatus", toStatus);
            startTransition(async () => {
              const result = await transitionStatusAction(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              // Reset error for the next open
              setError(null);
            });
          }}
        >
          {/* Current → new chip preview */}
          <div className="flex items-center gap-3 rounded-md bg-lightgrey px-3 py-3">
            <div>
              <p className="label-sm pb-1.5">Current</p>
              <StatusChip status={currentStatus} />
            </div>
            <ArrowRight size={14} className="text-navy/30 mt-5" strokeWidth={1.6} />
            <div>
              <p className="label-sm pb-1.5">New</p>
              <StatusChip status={toStatus} />
            </div>
          </div>

          <div>
            <Label htmlFor="td-toStatus" className={labelClasses}>
              Move to
            </Label>
            <select
              id="td-toStatus"
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value as EnrollmentStatus)}
              className={selectClasses}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="td-subStatus" className={labelClasses}>
              Sub-status (free-form text)
            </Label>
            <Input
              id="td-subStatus"
              name="subStatus"
              defaultValue={currentSubStatus}
              placeholder="e.g. Awaiting credentialing committee"
              className={inputClasses}
            />
          </div>

          <div>
            <Label htmlFor="td-reason" className={labelClasses}>
              Reason (required)
            </Label>
            <Textarea
              id="td-reason"
              name="reason"
              rows={3}
              required
              placeholder={
                isOffRail
                  ? "Why this is non-par credentialed — recorded in status history."
                  : "Recorded in status history."
              }
              className={inputClasses}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || toStatus === currentStatus}>
              {pending ? "Saving…" : "Apply transition"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
