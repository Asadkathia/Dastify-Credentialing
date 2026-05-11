import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI card matching the design files — white surface, colored top accent
 * stripe, label + icon-tile row, large value, one-line hint underneath.
 *
 * Tones map to: teal (in-progress), amber (needs attention),
 * blue (informational), green (success), navy (neutral).
 */
type Tone = "teal" | "amber" | "blue" | "green" | "navy";

const TONE_STYLES: Record<
  Tone,
  { accent: string; iconBg: string; iconText: string; valueText: string }
> = {
  teal: {
    accent: "bg-teal",
    iconBg: "bg-teal-08",
    iconText: "text-teal",
    valueText: "text-navy",
  },
  amber: {
    accent: "bg-warning",
    iconBg: "bg-warning-08",
    iconText: "text-[#7a4f00]",
    valueText: "text-navy",
  },
  blue: {
    accent: "bg-[#1565C0]",
    iconBg: "bg-[#1565C0]/10",
    iconText: "text-[#1565C0]",
    valueText: "text-navy",
  },
  green: {
    accent: "bg-success",
    iconBg: "bg-success-08",
    iconText: "text-[#1B5E20]",
    valueText: "text-navy",
  },
  navy: {
    accent: "bg-navy",
    iconBg: "bg-navy-08",
    iconText: "text-navy",
    valueText: "text-navy",
  },
};

export function DesignKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  asLink,
  href,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone: Tone;
  asLink?: boolean;
  href?: string;
  className?: string;
}) {
  const t = TONE_STYLES[tone];

  const body = (
    <>
      {/* Colored top accent stripe */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", t.accent)} />

      <div className="flex items-start justify-between gap-3">
        <p className="label-sm">{label}</p>
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            t.iconBg,
            t.iconText,
          )}
        >
          <Icon size={17} strokeWidth={1.8} />
        </span>
      </div>

      <p
        className={cn(
          "mt-4 text-[36px] font-bold leading-none tracking-[-0.01em] tnum",
          t.valueText,
        )}
      >
        {value}
      </p>

      {hint ? <p className="mt-3 text-[12px] text-navy/55">{hint}</p> : null}
    </>
  );

  const baseClass = cn(
    "relative block overflow-hidden rounded-md border border-border-subtle bg-white px-5 py-4 shadow-[var(--shadow-xs)]",
    asLink && "transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)]",
    className,
  );

  if (asLink && href) {
    // Defer to Next.js Link at the call-site; here we just emit an <a> for
    // when this is used in raw HTML contexts. Most callers will wrap in <Link>.
    return (
      <a href={href} className={baseClass}>
        {body}
      </a>
    );
  }

  return <div className={baseClass}>{body}</div>;
}
