"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteEnrollmentAction } from "@/lib/actions/enrollments";

const HARD_CONFIRM_WORD = "DELETE";
const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function DeleteEnrollmentDialog({
  enrollmentId,
  label,
  compact = false,
  redirectTo,
}: {
  enrollmentId: string;
  /** Human label for the enrollment, e.g. "Aetna · TX". Shown in the warning. */
  label: string;
  /** Render an icon-only trigger sized for a table row. */
  compact?: boolean;
  /** Navigate here on success (e.g. the detail page leaving itself). Omit to
   *  stay in place and just refresh — the list-row use. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hard, setHard] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hardReady =
    confirmWord.trim().toUpperCase() === HARD_CONFIRM_WORD && password.length > 0;
  const canSubmit = !hard || hardReady;

  function reset() {
    setHard(false);
    setConfirmWord("");
    setPassword("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("enrollmentId", enrollmentId);
    form.set("mode", hard ? "hard" : "soft");
    if (hard) form.set("password", password);

    startTransition(async () => {
      const res = await deleteEnrollmentAction(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label={`Delete ${label}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-navy/45 transition-colors hover:bg-danger-08 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
          >
            <Trash2 size={14} strokeWidth={1.7} />
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-danger/30 text-danger hover:bg-danger-08 hover:text-danger"
          >
            <Trash2 size={13} strokeWidth={1.7} className="mr-1.5" />
            Delete
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete enrollment</DialogTitle>
          <DialogDescription>
            Archive <span className="font-semibold text-navy">{label}</span>, or switch on permanent
            deletion below.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Soft is the default; the toggle escalates to a permanent purge. */}
          <div
            className={
              "flex items-start justify-between gap-4 rounded-md border p-3 transition-colors " +
              (hard ? "border-danger/40 bg-danger-08" : "border-border-subtle bg-white")
            }
          >
            <div>
              <p className={"text-[13px] font-semibold " + (hard ? "text-danger" : "text-navy")}>
                Permanently delete
              </p>
              <p className="mt-0.5 text-[12px] text-navy/60">
                {hard
                  ? "Irreversible. Purges the enrollment with its comments, internal notes, and documents. Requires your admin password. Audit history is retained."
                  : "Off: archive only — reversible, history kept, and frees the payer + state slot for re-enrollment."}
              </p>
            </div>
            <Switch
              checked={hard}
              onChange={setHard}
              ariaLabel="Permanently delete this enrollment"
            />
          </div>

          {hard ? (
            <div className="space-y-4 rounded-md border border-danger/25 bg-danger-08 p-4">
              <p className="flex items-start gap-2 text-[12px] text-danger">
                <AlertTriangle size={14} strokeWidth={1.8} className="mt-px shrink-0" />
                This cannot be undone. Confirm to permanently delete.
              </p>

              <div>
                <Label htmlFor="del-confirm" className={labelClasses}>
                  Type {HARD_CONFIRM_WORD} to confirm
                </Label>
                <Input
                  id="del-confirm"
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  autoComplete="off"
                  placeholder={HARD_CONFIRM_WORD}
                  className="mt-2 bg-white text-[13px]"
                />
              </div>

              <div>
                <Label htmlFor="del-password" className={labelClasses}>
                  Your admin password
                </Label>
                <Input
                  id="del-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-2 bg-white text-[13px]"
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={pending || !canSubmit}>
              {pending ? "Deleting…" : hard ? "Permanently delete" : "Archive enrollment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
        (checked ? "bg-danger focus-visible:ring-danger/40" : "bg-grey/50 focus-visible:ring-navy/20")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform " +
          (checked ? "translate-x-[22px]" : "translate-x-0.5")
        }
      />
    </button>
  );
}
