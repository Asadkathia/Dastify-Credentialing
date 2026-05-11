import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";

// Display order in the pipeline visualization.
// The 10-stage flow per CLAUDE.md §3 rule 18.
const PIPELINE: ReadonlyArray<{ key: EnrollmentStatus; label: string }> = [
  { key: "intake", label: "Intake" },
  { key: "prep", label: "Prep" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "info_requested", label: "Info Req" },
  { key: "approved", label: "Approved" },
  { key: "effective", label: "Effective" },
];

const TERMINAL: ReadonlyArray<{ key: EnrollmentStatus; label: string }> = [
  { key: "denied", label: "Denied" },
  { key: "closed", label: "Closed" },
  { key: "withdrawn", label: "Withdrawn" },
];

export function StatusPipeline({ status }: { status: EnrollmentStatus }) {
  const terminal = TERMINAL.find((t) => t.key === status);

  // If the enrollment ended in a terminal state, render the pipeline at 50%
  // opacity with an overlay tag showing the terminal label.
  const dimmed = !!terminal;
  const currentIdx = terminal
    ? PIPELINE.findIndex((s) => s.key === "approved") // anchor visually at "approved" when terminal
    : PIPELINE.findIndex((s) => s.key === status);

  return (
    <div className="relative">
      {dimmed && terminal ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span
            className={cn(
              "rounded-sm px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em]",
              terminal.key === "denied"
                ? "bg-danger-08 text-danger ring-1 ring-danger/30"
                : "bg-lightgrey text-navy/65 ring-1 ring-grey",
            )}
          >
            {terminal.label}
          </span>
        </div>
      ) : null}

      <ol
        className={cn(
          "relative flex items-center gap-2",
          dimmed && "opacity-40",
        )}
        aria-label="Status pipeline"
      >
        {PIPELINE.map((stage, i) => {
          const isPast = currentIdx > -1 && i < currentIdx;
          const isCurrent = currentIdx === i;
          return (
            <li
              key={stage.key}
              className="flex flex-1 items-center"
              data-state={isCurrent ? "current" : isPast ? "past" : "upcoming"}
            >
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tnum transition-colors",
                    isPast && "bg-success text-white",
                    isCurrent && "bg-teal text-white ring-4 ring-teal-12",
                    !isPast && !isCurrent && "bg-lightgrey text-navy/40 ring-1 ring-grey",
                  )}
                >
                  {isPast ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap",
                    isCurrent ? "text-navy" : isPast ? "text-success" : "text-navy/40",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1 h-px flex-1",
                    isPast ? "bg-success" : "bg-grey",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
