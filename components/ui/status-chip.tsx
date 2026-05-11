import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";

// Color mapping locked to the 6-status enum.
// Keys MUST stay in sync with `enrollmentStatusEnum`.
const STATUS_STYLE: Record<
  EnrollmentStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  prep: { bg: "bg-lightgrey", text: "text-navy", dot: "bg-aqua", label: "Prep" },
  submitted: { bg: "bg-teal-08", text: "text-navy", dot: "bg-teal", label: "Submitted" },
  in_review: { bg: "bg-teal-08", text: "text-navy", dot: "bg-teal", label: "In Review" },
  approved: {
    bg: "bg-success-08",
    text: "text-[#1B5E20]",
    dot: "bg-success",
    label: "Approved",
  },
  non_par_credentialed: {
    bg: "bg-warning-08",
    text: "text-[#7a4f00]",
    dot: "bg-warning",
    label: "Non-par credentialed",
  },
  completed: {
    bg: "bg-success-08",
    text: "text-[#1B5E20]",
    dot: "bg-success",
    label: "Completed",
  },
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
