"use client";
import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? mapError(initialError) : null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
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
      <div className="rounded-md border border-border bg-card p-6 text-center">
        <p className="font-medium">Check your email.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-mono">{email}</span>. The link is valid
          for one hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Work email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="you@yourpractice.com"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending || !email}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Sending link..." : "Email me a sign-in link"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        New users must be invited by an administrator. Self sign-up is disabled.
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
