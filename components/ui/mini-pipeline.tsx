import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { pipelineDisplayOrder } from "@/lib/enrollment/state-machine";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";

const ORDER = pipelineDisplayOrder();
const SHORT: Record<EnrollmentStatus, string> = {
  prep: "Prep",
  submitted: "Sub",
  in_review: "Rev",
  approved: "App",
  non_par_credentialed: "NP",
};

export function MiniPipeline({
  status,
  showLabels = false,
  className,
}: {
  status: EnrollmentStatus;
  showLabels?: boolean;
  className?: string;
}) {
  const isOffRail = status === "non_par_credentialed";
  const activeIdx = isOffRail
    ? ORDER.indexOf("in_review")
    : Math.max(0, ORDER.indexOf(status));

  return (
    <div className={cn("inline-flex items-center", className)} aria-label={`Pipeline at ${status}`}>
      {ORDER.map((stage, i) => {
        const reached = i <= activeIdx;
        const current = i === activeIdx;
        const palette = STATUS_COLORS[stage];
        return (
          <span key={stage} className="flex items-center">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px w-3 transition-colors",
                  // Connector stays brand-teal once crossed; only dots take
                  // on the per-stage assigned color.
                  i <= activeIdx ? "bg-teal" : "bg-grey/60",
                  isOffRail && i >= activeIdx && "opacity-40",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative h-2 w-2 rounded-full transition-colors",
                current
                  ? `${palette.classes.bgSolid} ring-[3px] ${palette.classes.ring}`
                  : reached
                    ? palette.classes.bgSolid
                    : "bg-grey/60",
                isOffRail && i > activeIdx && "opacity-40",
              )}
            />
            {showLabels ? (
              <span
                className={cn(
                  "ml-1 mr-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                  reached ? palette.classes.text : "text-navy/35",
                )}
              >
                {SHORT[stage]}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
