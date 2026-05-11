import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";

// Color mapping locked to the design files §4.1 and CLAUDE.md rule 18.
// Keys MUST stay in sync with `enrollmentStatusEnum`.
const STATUS_STYLE: Record<
  EnrollmentStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  intake: { bg: "bg-lightgrey", text: "text-charcoal", dot: "bg-grey", label: "Intake" },
  prep: { bg: "bg-teal-08", text: "text-navy", dot: "bg-aqua", label: "Prep" },
  submitted: { bg: "bg-teal-08", text: "text-navy", dot: "bg-teal", label: "Submitted" },
  in_review: { bg: "bg-teal-08", text: "text-navy", dot: "bg-teal", label: "In Review" },
  info_requested: {
    bg: "bg-warning-08",
    text: "text-charcoal",
    dot: "bg-warning",
    label: "Info Requested",
  },
  approved: {
    bg: "bg-success-08",
    text: "text-[#1B5E20]",
    dot: "bg-success",
    label: "Approved",
  },
  denied: { bg: "bg-danger-08", text: "text-danger", dot: "bg-danger", label: "Denied" },
  effective: {
    bg: "bg-success-08",
    text: "text-[#1B5E20]",
    dot: "bg-success",
    label: "Effective",
  },
  closed: { bg: "bg-lightgrey", text: "text-navy/55", dot: "bg-grey", label: "Closed" },
  withdrawn: { bg: "bg-lightgrey", text: "text-navy/55", dot: "bg-grey", label: "Withdrawn" },
};

export function StatusChip({
  status,
  size = "sm",
  className,
}: {
  status: EnrollmentStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = STATUS_STYLE[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-semibold uppercase leading-tight tracking-[0.06em]",
        size === "lg" ? "px-3 py-1.5 text-[12px]" : "px-2.5 py-1 text-[10px]",
        s.bg,
        s.text,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
