import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact summary tile — icon-on-the-left + value + small uppercase label.
 * Used in the clients-list 4-up stat strip and similar summary rows.
 */
type Tone = "teal" | "amber" | "blue" | "green" | "navy";

const TONE_STYLES: Record<Tone, { iconBg: string; iconText: string }> = {
  teal: { iconBg: "bg-teal-08", iconText: "text-teal" },
  amber: { iconBg: "bg-warning-08", iconText: "text-[#7a4f00]" },
  blue: { iconBg: "bg-[#1565C0]/10", iconText: "text-[#1565C0]" },
  green: { iconBg: "bg-success-08", iconText: "text-[#1B5E20]" },
  navy: { iconBg: "bg-navy-08", iconText: "text-navy" },
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  className?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border-subtle bg-white px-4 py-3 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          t.iconBg,
          t.iconText,
        )}
      >
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tracking-[-0.005em] tnum text-navy">
          {value}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy/55">
          {label}
        </div>
      </div>
    </div>
  );
}
