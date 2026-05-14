"use client";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completePasswordReset } from "@/lib/auth/actions";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const form = new FormData();
    form.set("password", password);

    startTransition(async () => {
      const result = await completePasswordReset(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.data.redirectTo;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className={labelClasses}>
          New password
        </label>
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
            minLength={8}
            autoComplete="new-password"
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
        {tooShort ? (
          <p className="mt-1.5 text-[12px] text-navy/55">
            Must be at least 8 characters.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirm" className={labelClasses}>
          Confirm new password
        </label>
        <div className="relative mt-2">
          <Lock
            aria-hidden
            size={15}
            strokeWidth={1.7}
            className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-navy/40"
          />
          <input
            id="confirm"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="flex h-12 w-full rounded-lg bg-lightgrey pl-4 pr-[46px] text-[13px] text-charcoal placeholder:text-navy/35 transition-[background-color,border-color,box-shadow] hover:bg-grey/30 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-teal/10 focus:[box-shadow:inset_0_0_0_1.5px_hsl(var(--teal))]"
          />
        </div>
        {mismatch ? (
          <p className="mt-1.5 text-[12px] text-danger">Passwords do not match.</p>
        ) : null}
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
        disabled={pending || password.length < 8 || password !== confirm}
        className="h-[50px] w-full text-[12px] uppercase tracking-[0.16em]"
      >
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
