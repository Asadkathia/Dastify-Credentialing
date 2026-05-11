"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "password" | "magic_link";

const inputClasses =
  "mt-2 flex h-10 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal placeholder:text-navy/35 focus-visible:border-teal focus-visible:outline-none";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? mapError(initialError) : null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();

      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        // Hard navigation so middleware re-runs with the freshly-set cookies and routes by role.
        window.location.href = next ?? "/";
        return;
      }

      // Magic link
      const redirectTo = `${window.location.origin}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
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
        className="inline-flex w-full rounded-md border border-border-subtle bg-lightgrey p-0.5"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          onClick={() => setMode("password")}
          data-active={mode === "password"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[var(--shadow-xs)]"
        >
          <KeyRound size={12} strokeWidth={1.6} />
          Password
        </button>
        <button
          type="button"
          role="tab"
          onClick={() => setMode("magic_link")}
          data-active={mode === "magic_link"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[var(--shadow-xs)]"
        >
          <MailCheck size={12} strokeWidth={1.6} />
          Magic link
        </button>
      </div>

      <div>
        <label htmlFor="email" className={labelClasses}>
          Work email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@yourpractice.com"
        />
      </div>

      {mode === "password" ? (
        <div>
          <label htmlFor="password" className={labelClasses}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
          />
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
        className="w-full"
      >
        {pending
          ? mode === "password"
            ? "Signing in…"
            : "Sending link…"
          : mode === "password"
            ? "Sign in"
            : "Email me a sign-in link"}
      </Button>

      <p className="text-center text-[11px] text-navy/55">
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
