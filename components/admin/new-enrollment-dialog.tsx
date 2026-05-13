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

export type OrgOption = { id: string; displayName: string };
export type ClientOption = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
};
export type GroupEntityOption = {
  id: string;
  organizationId: string;
  legalName: string;
};
export type PayerOption = {
  id: string;
  name: string;
  statesActive: string[];
};

export type NewEnrollmentDialogProps = {
  organizations: OrgOption[];
  clients: ClientOption[];
  groupEntities: GroupEntityOption[];
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

type SubjectKind = "client" | "group";

const SUBJECT_KIND_TABS: ReadonlyArray<{ id: SubjectKind; label: string }> = [
  { id: "client", label: "Individual client" },
  { id: "group", label: "Group entity" },
];

function clientDisplayName(c: ClientOption): string {
  const middle = c.middleName ? ` ${c.middleName[0]}.` : "";
  const suffix = c.suffix ? `, ${c.suffix}` : "";
  return `${c.lastName}, ${c.firstName}${middle}${suffix}`;
}

export function NewEnrollmentDialog({
  organizations,
  clients,
  groupEntities,
  payers,
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
  const [subjectKind, setSubjectKind] = useState<SubjectKind>(
    presetClientId ? "client" : "client",
  );
  const [clientId, setClientId] = useState<string>(presetClientId ?? "");
  const [groupEntityId, setGroupEntityId] = useState<string>("");
  const [payerId, setPayerId] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [subStatus, setSubStatus] = useState<string>("");

  const orgLocked = Boolean(presetOrganizationId);
  const clientLocked = Boolean(presetClientId);

  // Reset dependent state when the org changes (unless locked).
  useEffect(() => {
    if (clientLocked) return;
    setClientId("");
    setGroupEntityId("");
  }, [organizationId, clientLocked]);

  // Filter clients + groups to the chosen org.
  const orgClients = useMemo(
    () => clients.filter((c) => c.organizationId === organizationId),
    [clients, organizationId],
  );
  const orgGroups = useMemo(
    () => groupEntities.filter((g) => g.organizationId === organizationId),
    [groupEntities, organizationId],
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
    ((subjectKind === "client" && Boolean(clientId)) ||
      (subjectKind === "group" && Boolean(groupEntityId)));

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
      setGroupEntityId("");
      setPayerId("");
      setState("");
      setSubStatus("");
      router.refresh();
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
            One (subject × payer × state). Subject is a client (individual clinician) OR a group
            entity.
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

          {/* Subject kind tabs (hide when a client is locked in) */}
          {!clientLocked ? (
            <div className="flex gap-1 rounded-md bg-lightgrey p-1">
              {SUBJECT_KIND_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSubjectKind(t.id);
                    if (t.id === "client") setGroupEntityId("");
                    else setClientId("");
                  }}
                  className={
                    "flex-1 rounded-sm px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors " +
                    (subjectKind === t.id
                      ? "bg-white text-navy shadow-[var(--shadow-xs)]"
                      : "text-navy/55 hover:text-navy")
                  }
                  disabled={pending}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Client OR Group selector */}
          {subjectKind === "client" ? (
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ne-groupEntityId"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                Group entity
              </label>
              <select
                id="ne-groupEntityId"
                name="groupEntityId"
                value={groupEntityId}
                onChange={(e) => setGroupEntityId(e.target.value)}
                disabled={pending || !organizationId}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey disabled:text-navy/55"
              >
                <option value="">
                  {organizationId ? "Select group entity…" : "Pick an organization first"}
                </option>
                {orgGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.legalName}
                  </option>
                ))}
              </select>
              {organizationId && orgGroups.length === 0 ? (
                <p className="text-[11px] text-navy/55">
                  This organization has no group entities. Add one before creating a group
                  enrollment.
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
                  setPayerId(e.target.value);
                  // Clear state if it's no longer in the payer's active list
                  const p = payers.find((p) => p.id === e.target.value);
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
