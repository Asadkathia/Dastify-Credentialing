"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/auth/actions";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("email", email);
    startTransition(async () => {
      const result = await requestPasswordReset(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-md border border-success/30 bg-success-08 px-5 py-6 text-center">
        <CheckCircle2
          size={36}
          strokeWidth={1.6}
          className="mx-auto mb-3 text-[#1B5E20]"
          aria-hidden
        />
        <p className="text-[15px] font-semibold text-navy">Check your email</p>
        <p className="mt-1.5 text-[13px] text-navy/65">
          If an account exists for{" "}
          <span className="font-mono tnum text-charcoal">{email}</span>, we&apos;ve sent
          a password reset link. The link is valid for one hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className={labelClasses}>
          Work email
        </label>
        <div className="relative mt-2">
          <Mail
            aria-hidden
            size={15}
            strokeWidth={1.7}
            className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-navy/40"
          />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-12 w-full rounded-lg bg-lightgrey pl-4 pr-[46px] text-[13px] text-charcoal placeholder:text-navy/35 transition-[background-color,border-color,box-shadow] hover:bg-grey/30 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-teal/10 focus:[box-shadow:inset_0_0_0_1.5px_hsl(var(--teal))]"
            placeholder="you@yourpractice.com"
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !email}
        className="h-[50px] w-full text-[12px] uppercase tracking-[0.16em]"
      >
        {pending ? "Sending link…" : "Email me a reset link"}
      </Button>
    </form>
  );
}
