import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { pipelineDisplayOrder } from "@/lib/enrollment/state-machine";

const ORDER = pipelineDisplayOrder();
const SHORT: Record<EnrollmentStatus, string> = {
  prep: "Prep",
  submitted: "Sub",
  in_review: "Rev",
  approved: "App",
  non_par_credentialed: "NP",
  completed: "Done",
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
        return (
          <span key={stage} className="flex items-center">
            <span
              aria-hidden
              className={cn(
                "relative h-2 w-2 rounded-full transition-colors",
                current
                  ? "bg-teal ring-[3px] ring-teal/20"
                  : reached
                    ? "bg-teal"
                    : "bg-grey/60",
                isOffRail && i > activeIdx && "opacity-40",
              )}
            />
            {showLabels ? (
              <span
                className={cn(
                  "ml-1 mr-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                  reached ? "text-navy" : "text-navy/35",
                )}
              >
                {SHORT[stage]}
              </span>
            ) : null}
            {i < ORDER.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px w-3 transition-colors",
                  i < activeIdx ? "bg-teal" : "bg-grey/60",
                  isOffRail && i >= activeIdx && "opacity-40",
                )}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
