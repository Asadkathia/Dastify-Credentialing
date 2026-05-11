"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a sensitive provider field (DEA, SSN-last-4, DOB, Tax ID) masked by
 * default with an explicit Reveal click — per CLAUDE.md rule 15.
 *
 * - `value` is plaintext; the parent is responsible for decrypting via the
 *   server-side pgcrypto helpers before passing it in.
 * - `canReveal={false}` renders an irreversible "locked" state — used in client
 *   view where RLS won't return the encrypted bytea.
 */
export function SensitiveField({
  label,
  value,
  mask = "•••• ••••",
  canReveal = true,
  className,
}: {
  label: string;
  value?: string | null;
  mask?: string;
  canReveal?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const showValue = canReveal && revealed && value;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="label-sm">{label}</div>
      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-white px-3 py-2 text-[13px]">
        <span
          className={cn(
            "tnum flex-1",
            showValue ? "font-sans text-charcoal" : "font-mono tracking-wider text-navy/60",
          )}
        >
          {showValue ? value : mask}
        </span>
        {canReveal ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-navy/55 transition-colors hover:bg-navy-04 hover:text-navy"
          >
            {revealed ? <EyeOff size={12} strokeWidth={1.6} /> : <Eye size={12} strokeWidth={1.6} />}
            <span>{revealed ? "Hide" : "Reveal"}</span>
          </button>
        ) : (
          <span
            className="flex items-center gap-1 text-[11px] font-medium text-navy/40"
            title="Not available in this view"
          >
            <Lock size={12} strokeWidth={1.6} />
            Locked
          </span>
        )}
      </div>
    </div>
  );
}
