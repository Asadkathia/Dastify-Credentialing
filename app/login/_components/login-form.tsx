"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/auth/safe-next";

type Mode = "password" | "magic_link";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? mapError(initialError) : null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const safeNext = safeNextPath(next);

      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        window.location.href = safeNext;
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback${
        safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""
      }`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (error) {
        setError(error.message);
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
          We sent a sign-in link to{" "}
          <span className="font-mono tnum text-charcoal">{email}</span>. The link is valid for one
          hour.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMode("password");
          }}
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-teal hover:text-[#0E7475]"
        >
          Sign in a different way
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode toggle */}
      <div
        className="inline-flex w-full rounded-lg bg-lightgrey p-1"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          onClick={() => setMode("password")}
          data-active={mode === "password"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-[14px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[0_1px_6px_rgba(14,20,60,0.08)] data-[active=true]:[&_svg]:text-teal"
        >
          <KeyRound size={12} strokeWidth={1.7} />
          Password
        </button>
        <button
          type="button"
          role="tab"
          onClick={() => setMode("magic_link")}
          data-active={mode === "magic_link"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-[14px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[0_1px_6px_rgba(14,20,60,0.08)] data-[active=true]:[&_svg]:text-teal"
        >
          <MailCheck size={12} strokeWidth={1.7} />
          Magic link
        </button>
      </div>

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

      {mode === "password" ? (
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={labelClasses}>
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-teal hover:text-[#0E7475]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-2">
            <Lock
              aria-hidden
              size={15}
              strokeWidth={1.7}
              className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-navy/40"
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-12 w-full rounded-lg bg-lightgrey pl-4 pr-[78px] text-[13px] text-charcoal placeholder:text-navy/35 transition-[background-color,border-color,box-shadow] hover:bg-grey/30 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-teal/10 focus:[box-shadow:inset_0_0_0_1.5px_hsl(var(--teal))]"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-[40px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-navy/45 transition-colors hover:bg-white hover:text-navy"
            >
              {showPassword ? (
                <EyeOff size={14} strokeWidth={1.7} />
              ) : (
                <Eye size={14} strokeWidth={1.7} />
              )}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-navy/55">
          We&apos;ll email you a one-time sign-in link. No password needed.
        </p>
      )}

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
        disabled={pending || !email || (mode === "password" && !password)}
        className="h-[50px] w-full text-[12px] uppercase tracking-[0.16em]"
      >
        {pending
          ? mode === "password"
            ? "Signing in…"
            : "Sending link…"
          : mode === "password"
            ? "Sign in"
            : "Email me a sign-in link"}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-navy/55">
        <Lock size={11} strokeWidth={1.7} aria-hidden className="text-navy/40" />
        New users must be invited by an administrator.
      </p>
    </form>
  );
}

function mapError(code: string): string {
  switch (code) {
    case "no_profile":
      return "Your account is not linked to a portal profile. Please contact your administrator.";
    case "expired":
      return "Your sign-in link expired. Request a new one below.";
    default:
      return "Sign-in failed. Try again or contact your administrator.";
  }
}
