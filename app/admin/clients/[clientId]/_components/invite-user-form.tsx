"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteClientUserAction } from "@/lib/actions/clients";

type AuthMethod = "magic_link" | "password";

export function InviteClientUserForm({ clientId }: { clientId: string }) {
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
      <div className="space-y-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm">
        {success.method === "password" ? (
          <>
            <p className="font-medium text-green-900">Account created.</p>
            <p className="text-xs text-green-800">
              Share these credentials with the user securely (Signal, in person, password manager —
              not email):
            </p>
            <div className="rounded border border-green-200 bg-white p-2 font-mono text-xs">
              <div>
                <span className="text-muted-foreground">Email:</span> {success.email}
              </div>
              <div>
                <span className="text-muted-foreground">Password:</span> {success.password}
              </div>
              <div>
                <span className="text-muted-foreground">URL:</span>{" "}
                {typeof window !== "undefined" ? window.location.origin : ""}/login
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="font-medium text-green-900">Magic-link invite sent.</p>
            <p className="text-xs text-green-800">
              An email has been sent to <span className="font-mono">{success.email}</span>. The link
              is valid for one hour.
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
        Invite user
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 border-t pt-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          formData.set("authMethod", authMethod);
          if (authMethod === "password") formData.set("password", password);
          const email = String(formData.get("email") ?? "");
          const result = await inviteClientUserAction(formData);
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
      <input type="hidden" name="clientId" value={clientId} />

      <div className="space-y-1">
        <Label htmlFor="invite-fullName" className="text-xs">
          Full name
        </Label>
        <Input id="invite-fullName" name="fullName" required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="invite-email" className="text-xs">
          Email
        </Label>
        <Input id="invite-email" name="email" type="email" required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="invite-role" className="text-xs">
          Role
        </Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="client_viewer"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="client_viewer">Viewer (read + comment)</option>
          <option value="client_admin">Admin (manage users)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Auth method</Label>
        <div className="flex rounded-md border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setAuthMethod("magic_link")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              authMethod === "magic_link"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Magic link
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod("password")}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              authMethod === "password"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Email + password
          </button>
        </div>
      </div>

      {authMethod === "password" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="invite-password" className="text-xs">
              Initial password (≥ 8 chars)
            </Label>
            <button
              type="button"
              onClick={() => setPassword(generateStrongPassword())}
              className="text-xs text-primary hover:underline"
            >
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
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Share with the user securely. They can change it after first sign-in.
          </p>
        </div>
      )}

      {authMethod === "magic_link" && (
        <p className="text-xs text-muted-foreground">
          The user receives a one-time sign-in email. No password is set up front.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || (authMethod === "password" && password.length < 8)}
        >
          {pending
            ? "Working..."
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
