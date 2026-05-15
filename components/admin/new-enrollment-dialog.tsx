"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createEnrollmentAction } from "@/lib/actions/enrollments";
import { createPayerAction } from "@/lib/actions/payers";
import type { OrganizationKind } from "@/db/schema/organizations";

const PAYER_TYPES = [
  { value: "commercial", label: "Commercial" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "tricare", label: "TRICARE" },
  { value: "other", label: "Other" },
] as const;
type PayerType = (typeof PAYER_TYPES)[number]["value"];

const ALL_US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

function parseStateList(raw: string): { states: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const states: string[] = [];
  const invalid: string[] = [];
  for (const tok of tokens) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    if (/^[A-Z]{2}$/.test(tok)) states.push(tok);
    else invalid.push(tok);
  }
  return { states, invalid };
}

const ADD_NEW_PAYER_SENTINEL = "__add_new_payer__";

export type OrgOption = { id: string; displayName: string; kind: OrganizationKind };
export type ClientOption = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
};
export type PayerOption = {
  id: string;
  name: string;
  statesActive: string[];
};

export type NewEnrollmentDialogProps = {
  organizations: OrgOption[];
  clients: ClientOption[];
  payers: PayerOption[];
  /** When provided, organization is pre-selected and locked. */
  presetOrganizationId?: string;
  /** When provided, client is pre-selected and locked (implies presetOrganizationId). */
  presetClientId?: string;
  triggerLabel?: string;
  triggerSize?: "sm" | "default";
  triggerVariant?: "default" | "outline" | "ghost";
  triggerClassName?: string;
};

function clientDisplayName(c: ClientOption): string {
  const middle = c.middleName ? ` ${c.middleName[0]}.` : "";
  const suffix = c.suffix ? `, ${c.suffix}` : "";
  return `${c.lastName}, ${c.firstName}${middle}${suffix}`;
}

export function NewEnrollmentDialog({
  organizations,
  clients,
  payers: initialPayers,
  presetOrganizationId,
  presetClientId,
  triggerLabel = "New Enrollment",
  triggerSize = "default",
  triggerVariant = "default",
  triggerClassName,
}: NewEnrollmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [organizationId, setOrganizationId] = useState<string>(presetOrganizationId ?? "");
  const [clientId, setClientId] = useState<string>(presetClientId ?? "");
  const [payers, setPayers] = useState<PayerOption[]>(initialPayers);
  const [payerId, setPayerId] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [subStatus, setSubStatus] = useState<string>("");

  // Inline "add new payer" panel state.
  const [showAddPayer, setShowAddPayer] = useState(false);
  const [newPayerName, setNewPayerName] = useState("");
  const [newPayerType, setNewPayerType] = useState<PayerType>("commercial");
  const [newPayerAllStates, setNewPayerAllStates] = useState(true);
  const [newPayerStatesRaw, setNewPayerStatesRaw] = useState("");
  const [newPayerError, setNewPayerError] = useState<string | null>(null);
  const [addingPayer, startAddingPayer] = useTransition();

  // Keep local payer list in sync if the prop changes (e.g. after router.refresh
  // re-renders the server wrapper with newly-seeded payers).
  useEffect(() => {
    setPayers(initialPayers);
  }, [initialPayers]);

  const orgLocked = Boolean(presetOrganizationId);
  const clientLocked = Boolean(presetClientId);

  // Reset dependent state when the org changes (unless locked).
  useEffect(() => {
    if (clientLocked) return;
    setClientId("");
  }, [organizationId, clientLocked]);

  // Selected org drives whether we show the clinician picker.
  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId),
    [organizations, organizationId],
  );
  const orgKind: OrganizationKind | undefined = selectedOrg?.kind;

  // Filter clients to the chosen org.
  const orgClients = useMemo(
    () => clients.filter((c) => c.organizationId === organizationId),
    [clients, organizationId],
  );

  // Filter payers/states cascade: state options are constrained to what the
  // selected payer is active in. Defaults to all distinct US states across all
  // payers if no payer selected.
  const selectedPayer = useMemo(
    () => payers.find((p) => p.id === payerId),
    [payers, payerId],
  );
  const stateOptions = useMemo(() => {
    if (selectedPayer) return [...selectedPayer.statesActive].sort();
    const set = new Set<string>();
    for (const p of payers) for (const s of p.statesActive) set.add(s);
    return Array.from(set).sort();
  }, [payers, selectedPayer]);

  const canSubmit =
    !pending &&
    Boolean(organizationId) &&
    Boolean(payerId) &&
    Boolean(state) &&
    (orgKind === "individual" || Boolean(clientId));

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createEnrollmentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Close + refresh listings.
      setOpen(false);
      // Reset (preserving locked presets).
      if (!orgLocked) setOrganizationId("");
      if (!clientLocked) setClientId("");
      setPayerId("");
      setState("");
      setSubStatus("");
      router.refresh();
    });
  }

  function resetAddPayerPanel() {
    setShowAddPayer(false);
    setNewPayerName("");
    setNewPayerType("commercial");
    setNewPayerAllStates(true);
    setNewPayerStatesRaw("");
    setNewPayerError(null);
  }

  function handleAddPayer() {
    setNewPayerError(null);

    const trimmed = newPayerName.trim();
    if (trimmed.length < 2) {
      setNewPayerError("Name must be at least 2 characters.");
      return;
    }

    let statesActive: string[];
    if (newPayerAllStates) {
      statesActive = ALL_US_STATES;
    } else {
      const parsed = parseStateList(newPayerStatesRaw);
      if (parsed.invalid.length > 0) {
        setNewPayerError(
          `Invalid state code${parsed.invalid.length > 1 ? "s" : ""}: ${parsed.invalid.join(", ")}. Use 2-letter US codes.`,
        );
        return;
      }
      if (parsed.states.length === 0) {
        setNewPayerError("Enter at least one 2-letter US state code, or check 'all US states'.");
        return;
      }
      statesActive = parsed.states;
    }

    startAddingPayer(async () => {
      const result = await createPayerAction({
        name: trimmed,
        payerType: newPayerType,
        statesActive,
      });
      if (!result.ok) {
        setNewPayerError(result.error);
        return;
      }
      // Merge into local list (case-insensitive dedupe is handled server-side —
      // result.data.isExisting tells us it was already there).
      const merged: PayerOption = {
        id: result.data.id,
        name: result.data.name,
        statesActive,
      };
      setPayers((prev) => {
        const without = prev.filter((p) => p.id !== merged.id);
        const next = [...without, merged];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setPayerId(merged.id);
      // Reset state if the previously-picked state isn't covered by the new payer.
      if (state && !statesActive.includes(state)) setState("");
      resetAddPayerPanel();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
        >
          <Plus size={14} strokeWidth={1.6} className="mr-1.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New enrollment</DialogTitle>
          <DialogDescription>
            One (clinician × payer × state). For individual-practice organizations the singleton
            clinician is selected automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-busy={pending}
        >
          {/* Organization */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ne-organizationId" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65">
              Organization
            </label>
            <select
              id="ne-organizationId"
              name="organizationId"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              disabled={orgLocked || pending}
              required
              className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey disabled:text-navy/55"
            >
              <option value="">Select organization…</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Clinician picker — hidden for Individual orgs (server resolves singleton). */}
          {orgKind === "individual" ? (
            <p className="rounded-md bg-lightgrey px-3 py-2 text-[12px] text-navy/65">
              This will be enrolled for the practice&apos;s clinician.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ne-clientId"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                Client (clinician)
              </label>
              <select
                id="ne-clientId"
                name="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={clientLocked || pending || !organizationId}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey disabled:text-navy/55"
              >
                <option value="">
                  {organizationId ? "Select client…" : "Pick an organization first"}
                </option>
                {orgClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientDisplayName(c)}
                  </option>
                ))}
              </select>
              {organizationId && orgClients.length === 0 ? (
                <p className="text-[11px] text-navy/55">
                  This organization has no clients yet. Add one before creating an enrollment.
                </p>
              ) : null}
            </div>
          )}

          {/* Payer + State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ne-payerId"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                Payer
              </label>
              <select
                id="ne-payerId"
                name="payerId"
                value={payerId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === ADD_NEW_PAYER_SENTINEL) {
                    setShowAddPayer(true);
                    setNewPayerError(null);
                    return;
                  }
                  setPayerId(v);
                  setShowAddPayer(false);
                  // Clear state if it's no longer in the payer's active list
                  const p = payers.find((p) => p.id === v);
                  if (p && state && !p.statesActive.includes(state)) setState("");
                }}
                disabled={pending}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey"
              >
                <option value="">Select payer…</option>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={ADD_NEW_PAYER_SENTINEL}>+ Other (add new payer)…</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ne-state"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                State
              </label>
              <select
                id="ne-state"
                name="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={pending || stateOptions.length === 0}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey"
              >
                <option value="">Select state…</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showAddPayer ? (
            <div className="rounded-md border border-teal/30 bg-teal-08 p-3">
              <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/70">
                Add a new payer to the master list
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ne-newPayerName"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
                  >
                    Name
                  </label>
                  <input
                    id="ne-newPayerName"
                    value={newPayerName}
                    onChange={(e) => setNewPayerName(e.target.value)}
                    placeholder="e.g. Aetna"
                    minLength={2}
                    maxLength={120}
                    disabled={addingPayer}
                    className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ne-newPayerType"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
                  >
                    Type
                  </label>
                  <select
                    id="ne-newPayerType"
                    value={newPayerType}
                    onChange={(e) => setNewPayerType(e.target.value as PayerType)}
                    disabled={addingPayer}
                    className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none"
                  >
                    {PAYER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 text-[12px] text-navy/80">
                  <input
                    type="checkbox"
                    checked={newPayerAllStates}
                    onChange={(e) => setNewPayerAllStates(e.target.checked)}
                    disabled={addingPayer}
                    className="h-4 w-4 rounded border-border-subtle text-teal focus:ring-teal"
                  />
                  Available in all US states (51 incl. DC)
                </label>
                {!newPayerAllStates ? (
                  <input
                    value={newPayerStatesRaw}
                    onChange={(e) => setNewPayerStatesRaw(e.target.value)}
                    placeholder="TX, CA, NY"
                    disabled={addingPayer}
                    className="mt-2 h-9 w-full rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none"
                  />
                ) : null}
              </div>
              {newPayerError ? (
                <p className="mt-2 rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger">
                  {newPayerError}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddPayer}
                  disabled={addingPayer || newPayerName.trim().length < 2}
                >
                  {addingPayer ? "Adding…" : "Add payer"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetAddPayerPanel}
                  disabled={addingPayer}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {/* Optional sub-status */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="ne-subStatus"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
            >
              Sub-status (optional)
            </label>
            <input
              id="ne-subStatus"
              name="subStatus"
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
              placeholder="e.g. CAQH pending"
              disabled={pending}
              className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Creating…" : "Create enrollment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
