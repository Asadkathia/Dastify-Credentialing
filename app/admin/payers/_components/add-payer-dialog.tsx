"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { createPayerAction } from "@/lib/actions/payers";

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

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";
const selectClasses =
  "mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal focus-visible:border-teal focus-visible:outline-none";
const inputClasses = "mt-2 bg-white text-[13px]";

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

export function AddPayerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [payerType, setPayerType] = useState<PayerType>("commercial");
  const [allStates, setAllStates] = useState(true);
  const [statesRaw, setStatesRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPayerType("commercial");
    setAllStates(true);
    setStatesRaw("");
    setError(null);
    setInfo(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    let statesActive: string[];
    if (allStates) {
      statesActive = ALL_US_STATES;
    } else {
      const { states, invalid } = parseStateList(statesRaw);
      if (invalid.length > 0) {
        setError(`Invalid state code${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}. Use 2-letter US codes.`);
        return;
      }
      statesActive = states;
    }

    startTransition(async () => {
      const result = await createPayerAction({
        name: trimmedName,
        payerType,
        statesActive,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.isExisting) {
        setInfo(`A payer named "${result.data.name}" already exists — no changes made.`);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus size={14} strokeWidth={1.8} className="mr-1.5" />
          Add payer
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add payer</DialogTitle>
          <DialogDescription>
            Payers are global — added here, available to every client.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="ap-name" className={labelClasses}>
              Name
            </Label>
            <Input
              id="ap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aetna"
              autoFocus
              required
              minLength={2}
              maxLength={120}
              className={inputClasses}
            />
          </div>

          <div>
            <Label htmlFor="ap-type" className={labelClasses}>
              Payer type
            </Label>
            <select
              id="ap-type"
              value={payerType}
              onChange={(e) => setPayerType(e.target.value as PayerType)}
              className={selectClasses}
            >
              {PAYER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className={labelClasses}>Active states</Label>
            <label className="mt-2 flex items-center gap-2 text-[13px] text-navy/80">
              <input
                type="checkbox"
                checked={allStates}
                onChange={(e) => setAllStates(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle text-teal focus:ring-teal"
              />
              Available in all US states (51 incl. DC)
            </label>
            {!allStates ? (
              <div className="mt-3">
                <Input
                  value={statesRaw}
                  onChange={(e) => setStatesRaw(e.target.value)}
                  placeholder="TX, CA, NY"
                  className={inputClasses}
                />
                <p className="mt-1.5 text-[11px] text-navy/55">
                  Comma- or space-separated 2-letter US state codes.
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}

          {info ? (
            <p
              role="status"
              className="rounded-md border border-warning/20 bg-warning-08 px-3 py-2 text-[12px] text-[#7a4f00]"
            >
              {info}
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
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Add payer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
