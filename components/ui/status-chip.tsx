import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";

export function StatusChip({
  status,
  size = "sm",
  className,
}: {
  status: EnrollmentStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = STATUS_COLORS[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-semibold uppercase leading-tight tracking-[0.06em]",
        size === "lg" ? "px-3 py-1.5 text-[12px]" : "px-2.5 py-1 text-[10px]",
        s.classes.bgTint,
        s.classes.text,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.classes.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
