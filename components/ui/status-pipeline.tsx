import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";

// Linear pipeline order — matches `pipelineDisplayOrder()` in state-machine.ts.
const PIPELINE: ReadonlyArray<{ key: EnrollmentStatus; label: string }> = [
  { key: "prep", label: "Prep" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
];

// Terminal off-rail outcome (renders as an overlay tag dimming the rail).
const TERMINAL: ReadonlyArray<{ key: EnrollmentStatus; label: string }> = [
  { key: "non_par_credentialed", label: "Non-par credentialed" },
];

export function StatusPipeline({ status }: { status: EnrollmentStatus }) {
  const terminal = TERMINAL.find((t) => t.key === status);

  // If the enrollment ended off-rail, render the rail at 40% opacity with an
  // overlay tag showing the terminal label.
  const dimmed = !!terminal;
  const currentIdx = terminal
    ? // Anchor visually at "approved" — the most likely fork-off point.
      PIPELINE.findIndex((s) => s.key === "approved")
    : PIPELINE.findIndex((s) => s.key === status);

  return (
    <div className="relative">
      {dimmed && terminal ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded-sm bg-warning-08 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#7a4f00] ring-1 ring-warning/30">
            {terminal.label}
          </span>
        </div>
      ) : null}

      <ol
        className={cn("relative flex items-center gap-2", dimmed && "opacity-40")}
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
                    "whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.06em]",
                    isCurrent ? "text-navy" : isPast ? "text-success" : "text-navy/40",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("mx-1 h-px flex-1", isPast ? "bg-success" : "bg-grey")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
