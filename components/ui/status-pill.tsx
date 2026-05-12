import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";

// Compact pill variant for inline use in activity feeds and history tables.
// (Differs from StatusChip: smaller, no "size" prop, dimmer "from" tone.)
const PILL_TONES: Record<EnrollmentStatus, { bg: string; fg: string; dot: string }> = {
  prep: {
    bg: "bg-teal-08",
    fg: "text-teal",
    dot: "bg-teal",
  },
  submitted: {
    bg: "bg-[#1565C0]/10",
    fg: "text-[#1565C0]",
    dot: "bg-[#1565C0]",
  },
  in_review: {
    bg: "bg-[#1565C0]/10",
    fg: "text-[#1565C0]",
    dot: "bg-[#1565C0]",
  },
  approved: {
    bg: "bg-success-08",
    fg: "text-[#1B5E20]",
    dot: "bg-success",
  },
  non_par_credentialed: {
    bg: "bg-warning-08",
    fg: "text-[#7a4f00]",
    dot: "bg-warning",
  },
  completed: {
    bg: "bg-success-08",
    fg: "text-[#1B5E20]",
    dot: "bg-success",
  },
};

export function StatusPill({
  status,
  muted = false,
  className,
}: {
  status: EnrollmentStatus;
  /** When true (e.g. "from" side of a transition), washes out to a neutral grey pill. */
  muted?: boolean;
  className?: string;
}) {
  if (muted) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-navy-04 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy/55",
          className,
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-navy/40" />
        {STATUS_LABELS[status]}
      </span>
    );
  }
  const t = PILL_TONES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        t.bg,
        t.fg,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
