"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfileName, changeEmail, changePassword } from "@/lib/auth/profile-actions";

export function ProfileScreen({
  fullName,
  email,
  roleLabel,
}: {
  fullName: string;
  email: string;
  roleLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <DetailsCard fullName={fullName} email={email} roleLabel={roleLabel} />
      <EmailCard currentEmail={email} />
      <PasswordCard />
    </div>
  );
}

function DetailsCard({
  fullName,
  email,
  roleLabel,
}: {
  fullName: string;
  email: string;
  roleLabel: string;
}) {
  const [name, setName] = useState(fullName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const dirty = name.trim() !== fullName.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const form = new FormData();
    form.set("fullName", name);
    startTransition(async () => {
      const res = await updateProfileName(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHead title="Your details" description="Your name as it appears across the portal." />

      <div>
        <FieldLabel htmlFor="fullName" required>
          Full name
        </FieldLabel>
        <Input
          id="fullName"
          name="fullName"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDone(false);
          }}
          className="mt-2 bg-white text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Email" value={email} />
        <ReadOnlyField label="Role" value={roleLabel} />
      </div>

      <Feedback error={error} done={done} doneText="Name updated." />

      <div className="flex justify-end border-t border-border-subtle pt-5">
        <Button type="submit" size="sm" disabled={pending || !dirty || name.trim().length < 2}>
          {pending ? "Saving…" : "Save name"}
        </Button>
      </div>
    </form>
  );
}

function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    const form = new FormData();
    form.set("newEmail", newEmail);
    startTransition(async () => {
      const res = await changeEmail(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSentTo(res.data.newEmail);
      setNewEmail("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHead
        title="Change email"
        description="We'll email a confirmation link to your current and new addresses. The change takes effect once confirmed."
      />

      <ReadOnlyField label="Current email" value={currentEmail} />

      <div>
        <FieldLabel htmlFor="newEmail" required>
          New email
        </FieldLabel>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          required
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="mt-2 bg-white text-[13px]"
        />
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {sentTo ? (
        <p
          role="status"
          className="rounded-md border border-teal/25 bg-teal-08 px-3 py-2 text-[13px] text-navy"
        >
          Confirmation sent to <span className="font-semibold">{sentTo}</span>. Check both inboxes
          to complete the change.
        </p>
      ) : null}

      <div className="flex justify-end border-t border-border-subtle pt-5">
        <Button type="submit" size="sm" disabled={pending || newEmail.trim().length === 0}>
          {pending ? "Sending…" : "Send confirmation"}
        </Button>
      </div>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const tooShort = next.length > 0 && next.length < 8;
  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    const form = new FormData();
    form.set("currentPassword", current);
    form.set("newPassword", next);
    startTransition(async () => {
      const res = await changePassword(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <CardHead
        title="Change password"
        description="Other active sessions are signed out after a password change."
      />

      <div>
        <FieldLabel htmlFor="currentPassword" required>
          Current password
        </FieldLabel>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="mt-2 bg-white text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="newPassword" required>
            New password
          </FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="mt-2 bg-white text-[13px]"
          />
          {tooShort ? (
            <p className="mt-1.5 text-[12px] text-navy/55">Must be at least 8 characters.</p>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor="confirmPassword" required>
            Confirm new password
          </FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 bg-white text-[13px]"
          />
          {mismatch ? (
            <p className="mt-1.5 text-[12px] text-danger">Passwords do not match.</p>
          ) : null}
        </div>
      </div>

      <Feedback error={error} done={done} doneText="Password changed." />

      <div className="flex justify-end border-t border-border-subtle pt-5">
        <Button type="submit" size="sm" disabled={pending || !canSubmit}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

const cardClass =
  "space-y-5 rounded-md border border-border-subtle bg-white p-6 shadow-[var(--shadow-xs)]";

function CardHead({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-navy">{title}</h2>
      <p className="mt-1 text-[12px] text-navy/55">{description}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70">{label}</p>
      <p className="mt-2 truncate text-[13px] text-navy/80">{value}</p>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70"
    >
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </Label>
  );
}

function Feedback({
  error,
  done,
  doneText,
}: {
  error: string | null;
  done: boolean;
  doneText: string;
}) {
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (done)
    return (
      <p
        role="status"
        className="rounded-md border border-teal/25 bg-teal-08 px-3 py-2 text-[13px] text-navy"
      >
        {doneText}
      </p>
    );
  return null;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
    >
      {children}
    </p>
  );
}
