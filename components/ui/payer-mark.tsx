import { cn } from "@/lib/utils";

const TONES = [
  { bg: "rgba(22,193,194,0.10)", fg: "#0E7475" }, // teal
  { bg: "rgba(14,20,60,0.06)", fg: "#0E143C" }, // navy
  { bg: "rgba(244,163,0,0.12)", fg: "#A66A00" }, // amber
  { bg: "rgba(46,125,50,0.10)", fg: "#1B5E20" }, // green
  { bg: "rgba(78,206,209,0.12)", fg: "#0E7475" }, // aqua
] as const;

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function PayerMark({
  name,
  size = 30,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const tone = toneFor(name);
  const initials = initialsFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[7px] font-bold tnum",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: tone.bg,
        color: tone.fg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials}
    </span>
  );
}
