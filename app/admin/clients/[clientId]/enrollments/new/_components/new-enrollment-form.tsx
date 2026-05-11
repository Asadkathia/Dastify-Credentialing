"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEnrollmentAction } from "@/lib/actions/enrollments";
import { createPayerAction } from "@/lib/actions/payers";

type Provider = { id: string; first_name: string; last_name: string };
type GroupEntity = { id: string; legal_name: string };
type Payer = { id: string; name: string };

const PAYER_TYPES = [
  { value: "commercial", label: "Commercial" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "tricare", label: "TRICARE" },
  { value: "other", label: "Other" },
] as const;

const selectClasses =
  "flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal focus-visible:border-teal focus-visible:outline-none";

const inputClasses = "bg-white text-[13px]";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";

export function NewEnrollmentForm({
  clientId,
  providers,
  groupEntities,
  initialPayers,
}: {
  clientId: string;
  providers: Provider[];
  groupEntities: GroupEntity[];
  initialPayers: Payer[];
}) {
  const router = useRouter();

  const [payers, setPayers] = useState<Payer[]>(initialPayers);
  const [selectedPayerId, setSelectedPayerId] = useState<string>("");
  const [showAddPayer, setShowAddPayer] = useState(false);
  const [newPayerName, setNewPayerName] = useState("");
  const [newPayerType, setNewPayerType] = useState<(typeof PAYER_TYPES)[number]["value"]>(
    "commercial",
  );
  const [newPayerRecredMonths, setNewPayerRecredMonths] = useState(24);
  const [addingPayer, startAddingPayer] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  function handleAddPayer() {
    setError(null);
    if (newPayerName.trim().length < 2) {
      setError("Payer name must be at least 2 characters");
      return;
    }
    startAddingPayer(async () => {
      const result = await createPayerAction({
        name: newPayerName.trim(),
        payerType: newPayerType,
        statesActive: [],
        recredCycleMonths: newPayerRecredMonths,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPayers((prev) => {
        const without = prev.filter((p) => p.id !== result.data.id);
        const next = [...without, { id: result.data.id, name: result.data.name }];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setSelectedPayerId(result.data.id);
      setShowAddPayer(false);
      setNewPayerName("");
      setNewPayerType("commercial");
      setNewPayerRecredMonths(24);
    });
  }

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        setError(null);
        startSubmitting(async () => {
          formData.set("clientId", clientId);
          formData.set("payerId", selectedPayerId);
          const result = await createEnrollmentAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/admin/clients/${clientId}/enrollments/${result.data.id}`);
        });
      }}
    >
      <FieldGroup label="Subject" hint="Pick a provider OR a group entity — never both (rule 10).">
        <div>
          <Label htmlFor="providerId" className={labelClasses}>
            Provider
          </Label>
          <select id="providerId" name="providerId" className={`mt-2 ${selectClasses}`} defaultValue="">
            <option value="">— Select a provider —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.last_name}, {p.first_name}
              </option>
            ))}
          </select>
        </div>

        {groupEntities.length > 0 ? (
          <div className="mt-4">
            <Label htmlFor="groupEntityId" className={labelClasses}>
              Or group entity
            </Label>
            <select
              id="groupEntityId"
              name="groupEntityId"
              className={`mt-2 ${selectClasses}`}
              defaultValue=""
            >
              <option value="">— No group enrollment —</option>
              {groupEntities.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.legal_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </FieldGroup>

      <FieldGroup label="Payer & state">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="payerId" className={labelClasses}>
              Payer <span className="text-danger">*</span>
            </Label>
            <select
              id="payerId"
              value={selectedPayerId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__add_new__") {
                  setShowAddPayer(true);
                  return;
                }
                setSelectedPayerId(v);
                setShowAddPayer(false);
              }}
              required
              className={`mt-2 ${selectClasses}`}
            >
              <option value="" disabled>
                — Select a payer —
              </option>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__add_new__">+ Other (add new payer)…</option>
            </select>
          </div>
          <div>
            <Label htmlFor="state" className={labelClasses}>
              State (2-letter) <span className="text-danger">*</span>
            </Label>
            <Input
              id="state"
              name="state"
              required
              maxLength={2}
              placeholder="TX"
              className={`mt-2 font-mono uppercase tracking-wider ${inputClasses}`}
            />
          </div>
        </div>

        {showAddPayer ? (
          <div className="mt-4 rounded-md border border-teal/30 bg-teal-08 p-4">
            <p className="label-sm pb-3">Add a new payer to the master list</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="newPayerName" className={labelClasses}>
                  Name <span className="text-danger">*</span>
                </Label>
                <Input
                  id="newPayerName"
                  value={newPayerName}
                  onChange={(e) => setNewPayerName(e.target.value)}
                  placeholder="e.g. Wellpoint Texas"
                  className={`mt-2 ${inputClasses}`}
                />
              </div>
              <div>
                <Label htmlFor="newPayerType" className={labelClasses}>
                  Type
                </Label>
                <select
                  id="newPayerType"
                  value={newPayerType}
                  onChange={(e) =>
                    setNewPayerType(e.target.value as (typeof PAYER_TYPES)[number]["value"])
                  }
                  className={`mt-2 ${selectClasses}`}
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
              <Label htmlFor="newPayerRecred" className={labelClasses}>
                Recred cycle (months, default 24)
              </Label>
              <Input
                id="newPayerRecred"
                type="number"
                min={1}
                max={120}
                value={newPayerRecredMonths}
                onChange={(e) => setNewPayerRecredMonths(parseInt(e.target.value, 10) || 24)}
                className={`mt-2 tnum ${inputClasses}`}
              />
            </div>
            <div className="mt-4 flex gap-2">
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
                onClick={() => {
                  setShowAddPayer(false);
                  setNewPayerName("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </FieldGroup>

      <FieldGroup label="Cycle & sub-status">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cycleNumber" className={labelClasses}>
              Cycle
            </Label>
            <Input
              id="cycleNumber"
              name="cycleNumber"
              type="number"
              min={1}
              defaultValue={1}
              className={`mt-2 tnum ${inputClasses}`}
            />
          </div>
          <div>
            <Label htmlFor="subStatus" className={labelClasses}>
              Sub-status (optional)
            </Label>
            <Input
              id="subStatus"
              name="subStatus"
              placeholder="e.g. Awaiting CV"
              className={`mt-2 ${inputClasses}`}
            />
          </div>
        </div>
      </FieldGroup>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
        <Button type="submit" disabled={submitting || !selectedPayerId}>
          {submitting ? "Creating enrollment…" : "Create enrollment"}
        </Button>
      </div>
    </form>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border-subtle pt-5 first:border-0 first:pt-0">
      <div className="pb-4">
        <p className="label-sm">{label}</p>
        {hint ? <p className="mt-1 text-[12px] text-navy/55">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
