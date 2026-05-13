"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Side-drawer filter panel for the admin clients list. Wraps the Dialog
 * primitive but is positioned as a right-aligned 360px panel. Drives URL
 * query params (?has_enrollments=1, ?state=TX). Search and tab filters live
 * in the parent page and are preserved through this drawer's apply call.
 */
export function OrganizationsFilterDrawer({
  status,
  q,
  hasEnrollments,
  state,
}: {
  status: "all" | "active" | "inactive";
  q: string;
  hasEnrollments: boolean;
  state: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draftHasEnrollments, setDraftHasEnrollments] = React.useState(hasEnrollments);
  const [draftState, setDraftState] = React.useState(state);

  // Reset draft state when drawer opens or props change.
  React.useEffect(() => {
    if (open) {
      setDraftHasEnrollments(hasEnrollments);
      setDraftState(state);
    }
  }, [open, hasEnrollments, state]);

  // Compute count of "extra" filters active (not status/q) for the badge.
  const extraCount = (hasEnrollments ? 1 : 0) + (state ? 1 : 0);

  function buildHref(params: {
    status: string;
    q: string;
    hasEnrollments: boolean;
    state: string;
  }) {
    const sp = new URLSearchParams();
    if (params.status && params.status !== "all") sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    if (params.hasEnrollments) sp.set("has_enrollments", "1");
    if (params.state) sp.set("state", params.state.toUpperCase());
    const qs = sp.toString();
    return qs ? `/admin/organizations?${qs}` : "/admin/organizations";
  }

  function apply() {
    const trimmedState = draftState.trim().toUpperCase();
    router.push(
      buildHref({
        status,
        q,
        hasEnrollments: draftHasEnrollments,
        state: trimmedState,
      }),
    );
    setOpen(false);
  }

  function clearAll() {
    setDraftHasEnrollments(false);
    setDraftState("");
    router.push(buildHref({ status, q, hasEnrollments: false, state: "" }));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={14} strokeWidth={1.6} />
        Filter
        {extraCount > 0 ? (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[10px] font-semibold text-white">
            {extraCount}
          </span>
        ) : null}
      </Button>

      <DialogContent
        // Override the centered defaults — slide-in side panel anchored to the right.
        className="fixed left-auto right-0 top-0 max-w-[360px] translate-x-0 translate-y-0 rounded-none border-l border-border-subtle p-0 sm:max-w-[360px] h-screen grid-rows-[auto_1fr_auto]"
      >
        <DialogHeader className="border-b border-border-subtle px-5 pt-5 pb-4 pr-12">
          <DialogTitle>Filter clients</DialogTitle>
          <p className="text-[12px] text-navy/55">
            Narrow the list by enrollment activity or operating state.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            {/* Has enrollments toggle */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="filter-has-enrollments"
                  className="block text-[13px] font-medium text-navy"
                >
                  Has enrollments
                </label>
                <p className="mt-0.5 text-[11px] text-navy/55">
                  Only show clients with at least one active enrollment.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draftHasEnrollments}
                id="filter-has-enrollments"
                onClick={() => setDraftHasEnrollments((v) => !v)}
                className={
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors " +
                  (draftHasEnrollments
                    ? "border-teal bg-teal"
                    : "border-border-subtle bg-lightgrey")
                }
              >
                <span
                  aria-hidden
                  className={
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                    (draftHasEnrollments ? "translate-x-4" : "translate-x-0.5") +
                    " mt-[1px]"
                  }
                />
              </button>
            </div>

            {/* State 2-letter input */}
            <div>
              <label
                htmlFor="filter-state"
                className="block text-[13px] font-medium text-navy"
              >
                State
              </label>
              <p className="mt-0.5 text-[11px] text-navy/55">
                US 2-letter code (e.g. TX). Filters to clients with any
                enrollment in that state.
              </p>
              <input
                id="filter-state"
                type="text"
                inputMode="text"
                maxLength={2}
                value={draftState}
                onChange={(e) => setDraftState(e.target.value.toUpperCase())}
                placeholder="TX"
                className="mt-2 h-9 w-full rounded-md border border-border-subtle bg-white px-3 font-mono text-[13px] uppercase tracking-[0.04em] focus-visible:border-teal focus-visible:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle bg-white px-5 py-4">
          <button
            type="button"
            onClick={clearAll}
            className="text-[12px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:text-navy"
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
