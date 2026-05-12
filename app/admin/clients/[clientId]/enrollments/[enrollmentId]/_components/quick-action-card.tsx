"use client";

import { StatusTransitionDialog } from "./status-transition-dialog";
import type { EnrollmentStatus } from "@/db/schema/enums";

type QuickActionMessage = {
  /** Renders inline. Stage names get rendered teal-bold by inline JSX below. */
  current: string;
  next: string;
  body: string;
  cta: string;
};

// Pipeline statuses that have a "next action". Terminal statuses (`completed`,
// `non_par_credentialed`) are intentionally omitted — the card doesn't render.
const NEXT_ACTION: Partial<Record<EnrollmentStatus, QuickActionMessage>> = {
  prep: {
    current: "Prep",
    next: "Submitted",
    body: "Upload provider documents to advance.",
    cta: "Transition to Submitted",
  },
  submitted: {
    current: "Submitted",
    next: "In Review",
    body: "Wait for the payer to begin review.",
    cta: "Move to In Review",
  },
  in_review: {
    current: "In Review",
    next: "Approved",
    body: "Awaiting payer decision.",
    cta: "Mark as Approved",
  },
  approved: {
    current: "Approved",
    next: "Completed",
    body: "Final step: mark as Completed once provider is active in-network.",
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
        <p className="mb-4 text-[13px] leading-relaxed text-white/75">
          Currently in <span className="font-semibold text-teal">{message.current}</span>.{" "}
          {message.body} Advance to{" "}
          <span className="font-semibold text-teal">{message.next}</span>.
        </p>
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
