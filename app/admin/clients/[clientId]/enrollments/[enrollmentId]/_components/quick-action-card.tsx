"use client";

import { StatusTransitionDialog } from "./status-transition-dialog";
import type { EnrollmentStatus } from "@/db/schema/enums";

type QuickActionMessage = { text: string; cta: string };

// Pipeline statuses that have a "next action". Terminal statuses (`completed`,
// `non_par_credentialed`) are intentionally omitted — the card doesn't render.
const NEXT_ACTION: Partial<Record<EnrollmentStatus, QuickActionMessage>> = {
  prep: {
    text: "Currently in Prep. Upload provider documents to advance to Submitted.",
    cta: "Transition to Submitted",
  },
  submitted: {
    text: "Currently in Submitted. Wait for payer to begin review.",
    cta: "Move to In Review",
  },
  in_review: {
    text: "Currently in In Review. Awaiting payer decision.",
    cta: "Mark as Approved",
  },
  approved: {
    text: "Currently Approved. Final step: mark as Completed once provider is active in-network.",
    cta: "Mark as Completed",
  },
};

export function QuickActionCard({
  enrollmentId,
  currentStatus,
  currentSubStatus,
}: {
  enrollmentId: string;
  currentStatus: EnrollmentStatus;
  currentSubStatus: string;
}) {
  const message = NEXT_ACTION[currentStatus];
  if (!message) return null;

  return (
    <div className="relative mt-4 overflow-hidden rounded-md bg-navy p-5 text-white shadow-[var(--shadow-xs)]">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-teal/15 blur-xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-teal/10 blur-2xl"
      />
      <div className="relative">
        <p className="label-sm mb-2 text-white/40">Next action</p>
        <p className="mb-4 text-[13px] leading-relaxed text-white/75">{message.text}</p>
        <StatusTransitionDialog
          enrollmentId={enrollmentId}
          currentStatus={currentStatus}
          currentSubStatus={currentSubStatus}
          triggerLabel={message.cta}
          triggerVariant="quick-action"
        />
      </div>
    </div>
  );
}
