import {
  Check,
  Eye,
  type LucideIcon,
  Pencil,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { STATUS_COLORS } from "@/lib/enrollment/status-colors";

// Linear pipeline order — matches `pipelineDisplayOrder()` in state-machine.ts.
const PIPELINE: ReadonlyArray<{ key: EnrollmentStatus; label: string; Icon: LucideIcon }> = [
  { key: "prep", label: "Prep", Icon: Pencil },
  { key: "submitted", label: "Submitted", Icon: Send },
  { key: "in_review", label: "In Review", Icon: Eye },
  { key: "approved", label: "Approved", Icon: Check },
];

// Terminal off-rail outcome (renders as an overlay tag dimming the rail).
const TERMINAL: ReadonlyArray<{ key: EnrollmentStatus; label: string }> = [
  { key: "non_par_credentialed", label: "Non-par credentialed" },
];

export function StatusPipeline({
  status,
  subStatus,
}: {
  status: EnrollmentStatus;
  /** Optional italic sub-line rendered under the current stage label. */
  subStatus?: string | null;
}) {
  const terminal = TERMINAL.find((t) => t.key === status);
  const dimmed = !!terminal;
  const currentIdx = terminal
    ? PIPELINE.findIndex((s) => s.key === "approved")
    : PIPELINE.findIndex((s) => s.key === status);

  // Fill the brand-teal track up to the midpoint of the current stage.
  // The per-stage palette colors live only on the circles + labels; the
  // progress rail itself stays neutral teal (brand color) end-to-end.
  const filledPct =
    currentIdx >= 0 ? ((currentIdx + 0.5) / PIPELINE.length) * 100 : 0;

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
        className={cn("relative grid grid-cols-4 gap-2", dimmed && "opacity-40")}
        aria-label="Status pipeline"
      >
        {/* Continuous baseline track + teal fill up to current stage. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 right-5 top-5 h-0.5 -translate-y-1/2 bg-grey/50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-5 h-0.5 -translate-y-1/2 bg-teal transition-[width]"
          style={{ width: `calc((100% - 40px) * ${filledPct / 100})` }}
        />

        {PIPELINE.map((stage, i) => {
          const isPast = currentIdx > -1 && i < currentIdx;
          const isCurrent = currentIdx === i;
          const StageIcon = stage.Icon;
          const palette = STATUS_COLORS[stage.key];
          return (
            <li
              key={stage.key}
              className="relative flex flex-col items-center text-center"
              data-state={isCurrent ? "current" : isPast ? "past" : "upcoming"}
            >
              <span
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  isPast && `${palette.classes.bgSolid} text-white`,
                  isCurrent &&
                    `${palette.classes.bgSolid} text-white ring-4 ${palette.classes.ring}`,
                  !isPast &&
                    !isCurrent &&
                    "border-2 border-grey/60 bg-white text-navy/40",
                )}
              >
                {isPast ? (
                  <Check size={16} strokeWidth={2.4} />
                ) : (
                  <StageIcon size={16} strokeWidth={1.9} />
                )}
              </span>
              <span
                className={cn(
                  "mt-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em]",
                  (isCurrent || isPast) ? palette.classes.text : "text-navy/40",
                )}
              >
                {stage.label}
              </span>
              {isCurrent && subStatus ? (
                <span className={cn("mt-1 text-[11px] italic", palette.classes.text, "opacity-85")}>
                  {subStatus}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
