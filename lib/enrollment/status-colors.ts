import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Single source of truth for status colors across the portal.
 *
 *   prep        → blue
 *   submitted   → teal
 *   in_review   → yellow
 *   approved    → green
 *   non_par_*   → amber  (off-rail terminal)
 *
 * Every chip, pill, pipeline circle, KPI card, donut slice, and filter
 * chip pulls its color from here. CSS variables that mirror these values
 * live in app/globals.css (`--status-*`). Keep the two in sync.
 */

export type StatusToneName = "blue" | "teal" | "yellow" | "green" | "amber";

export type StatusColorEntry = {
  toneName: StatusToneName;
  /** Solid base color in hex (used for inline SVG/canvas, donut slices, chart bars). */
  hex: string;
  /** Deeper on-tint text color — passes contrast on the 10% tinted surface. */
  hexDeepText: string;
  /** Tailwind utility classes for the common surface variants. */
  classes: {
    /** Solid filled background, paired with white text (e.g. active pipeline circle). */
    bgSolid: string;
    /** ~10% tinted background, paired with `text` (e.g. chip / pill / tile background). */
    bgTint: string;
    /** Deep on-tint text color — for labels rendered on white or the tinted bg. */
    text: string;
    /** Small solid dot indicator. */
    dot: string;
    /** Glow ring (~15-20% alpha) for "current" circles. */
    ring: string;
    /** Solid 1-px border. */
    border: string;
    /** Solid background utility for SVG-less segments / track fills. */
    trackBg: string;
  };
};

export const STATUS_COLORS: Record<EnrollmentStatus, StatusColorEntry> = {
  prep: {
    toneName: "blue",
    hex: "#1565C0",
    hexDeepText: "#0D47A1",
    classes: {
      bgSolid: "bg-[#1565C0]",
      bgTint: "bg-[#1565C0]/10",
      text: "text-[#1565C0]",
      dot: "bg-[#1565C0]",
      ring: "ring-[#1565C0]/20",
      border: "border-[#1565C0]",
      trackBg: "bg-[#1565C0]",
    },
  },
  submitted: {
    toneName: "teal",
    hex: "#16C1C2",
    hexDeepText: "#0E7475",
    classes: {
      bgSolid: "bg-teal",
      bgTint: "bg-teal-08",
      text: "text-teal",
      dot: "bg-teal",
      ring: "ring-teal-12",
      border: "border-teal",
      trackBg: "bg-teal",
    },
  },
  in_review: {
    toneName: "yellow",
    hex: "#EAB308",
    hexDeepText: "#854D0E",
    classes: {
      bgSolid: "bg-[#EAB308]",
      bgTint: "bg-[#EAB308]/12",
      text: "text-[#854D0E]",
      dot: "bg-[#EAB308]",
      ring: "ring-[#EAB308]/25",
      border: "border-[#EAB308]",
      trackBg: "bg-[#EAB308]",
    },
  },
  approved: {
    toneName: "green",
    hex: "#2E7D32",
    hexDeepText: "#1B5E20",
    classes: {
      bgSolid: "bg-success",
      bgTint: "bg-success-08",
      text: "text-[#1B5E20]",
      dot: "bg-success",
      ring: "ring-success/20",
      border: "border-success",
      trackBg: "bg-success",
    },
  },
  non_par_credentialed: {
    toneName: "amber",
    hex: "#F4A300",
    hexDeepText: "#7A4F00",
    classes: {
      bgSolid: "bg-warning",
      bgTint: "bg-warning-08",
      text: "text-[#7a4f00]",
      dot: "bg-warning",
      ring: "ring-warning/25",
      border: "border-warning",
      trackBg: "bg-warning",
    },
  },
};

export function statusToneName(s: EnrollmentStatus): StatusToneName {
  return STATUS_COLORS[s].toneName;
}

export function statusHex(s: EnrollmentStatus): string {
  return STATUS_COLORS[s].hex;
}
