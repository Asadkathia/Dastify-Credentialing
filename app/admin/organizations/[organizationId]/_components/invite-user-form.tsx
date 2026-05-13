"use client";
import { useState, useTransition } from "react";
import { UserPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteOrganizationUserAction } from "@/lib/actions/organizations";

type AuthMethod = "magic_link" | "password";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";
const selectClasses =
  "mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal focus-visible:border-teal focus-visible:outline-none";
const inputClasses = "mt-2 bg-white text-[13px]";

export function InviteOrganizationUserForm({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    method: AuthMethod;
    email: string;
    password?: string;
  } | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("magic_link");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  if (success) {
    return (
      <div className="space-y-3 rounded-md border border-success/30 bg-success-08 px-4 py-3 text-[13px]">
        {success.method === "password" ? (
          <>
            <p className="font-semibold text-[#1B5E20]">Account created.</p>
            <p className="text-[12px] text-navy/70">
              Share these credentials with the user securely (Signal, in person, password manager —
              not email):
            </p>
            <div className="space-y-1 rounded-sm border border-success/20 bg-white p-3 font-mono text-[12px] tnum">
              <div>
                <span className="text-navy/55">Email: </span>
                {success.email}
              </div>
              <div>
                <span className="text-navy/55">Password: </span>
                {success.password}
              </div>
              <div>
                <span className="text-navy/55">URL: </span>
                {typeof window !== "undefined" ? window.location.origin : ""}/login
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold text-[#1B5E20]">Magic-link invite sent.</p>
            <p className="text-[12px] text-navy/70">
              An email has been sent to{" "}
              <span className="font-mono tnum">{success.email}</span>. The link is valid for one
              hour.
            </p>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setSuccess(null);
            setOpen(false);
            setPassword("");
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={12} strokeWidth={1.6} className="mr-1.5" />
        Invite user
      </Button>
    );
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          formData.set("authMethod", authMethod);
          if (authMethod === "password") formData.set("password", password);
          const email = String(formData.get("email") ?? "");
          const result = await inviteOrganizationUserAction(formData);
          if (!result.ok) {
            setError(result.error);
          } else {
            setSuccess({
              method: result.data.authMethod,
              email,
              password: result.data.authMethod === "password" ? password : undefined,
            });
          }
        });
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      <p className="label-sm">Invite portal user</p>

      <div>
        <Label htmlFor="invite-fullName" className={labelClasses}>
          Full name
        </Label>
        <Input id="invite-fullName" name="fullName" required className={inputClasses} />
      </div>

      <div>
        <Label htmlFor="invite-email" className={labelClasses}>
          Email
        </Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          className={inputClasses}
        />
      </div>

      <div>
        <Label htmlFor="invite-role" className={labelClasses}>
          Role
        </Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="org_viewer"
          className={selectClasses}
        >
          <option value="org_viewer">Viewer (read + comment)</option>
          <option value="org_admin">Admin (manage users)</option>
        </select>
      </div>

      <div>
        <p className={labelClasses}>Auth method</p>
        <div className="mt-2 inline-flex rounded-md border border-border-subtle bg-lightgrey p-0.5">
          <button
            type="button"
            onClick={() => setAuthMethod("magic_link")}
            data-active={authMethod === "magic_link"}
            className="rounded-sm px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[var(--shadow-xs)]"
          >
            Magic link
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod("password")}
            data-active={authMethod === "password"}
            className="rounded-sm px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/55 transition-colors data-[active=true]:bg-white data-[active=true]:text-navy data-[active=true]:shadow-[var(--shadow-xs)]"
          >
            Email + password
          </button>
        </div>
      </div>

      {authMethod === "password" ? (
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="invite-password" className={labelClasses}>
              Initial password (≥ 8 chars)
            </Label>
            <button
              type="button"
              onClick={() => setPassword(generateStrongPassword())}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-teal hover:text-[#0E7475]"
            >
              <RefreshCw size={10} strokeWidth={1.6} />
              Generate
            </button>
          </div>
          <Input
            id="invite-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className={`${inputClasses} font-mono tnum`}
          />
          <p className="mt-1 text-[11px] text-navy/55">
            Share with the user securely. They can change it after first sign-in.
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-navy/55">
          The user receives a one-time sign-in email. No password is set up front.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || (authMethod === "password" && password.length < 8)}
        >
          {pending
            ? "Working…"
            : authMethod === "password"
              ? "Create account"
              : "Send invite"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Generates a 16-char password from a URL-safe alphabet.
// Uses Web Crypto in the browser; safe to call from a "use client" component.
function generateStrongPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#$%&*+=?";
  const len = 16;
  const out = new Array(len);
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) {
    out[i] = alphabet[buf[i]! % alphabet.length];
  }
  return out.join("");
}
