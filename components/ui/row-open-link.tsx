import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Canonical row-CTA chip for every list table across admin + portal.
// Single source of truth — do not inline equivalent styles in pages.
export function RowOpenLink({
  href,
  label = "Open",
  ariaLabel,
  className,
}: {
  href: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-navy/85",
        className,
      )}
    >
      {label}
      <ChevronRight size={12} strokeWidth={2} />
    </Link>
  );
}
