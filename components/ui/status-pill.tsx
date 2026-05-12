import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";

// Compact pill variant for inline use in activity feeds and history tables.
// (Differs from StatusChip: smaller, no "size" prop, dimmer "from" tone.)
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
  const t = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        t.classes.bgTint,
        t.classes.text,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.classes.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
