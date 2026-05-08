"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadDocumentAction,
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
} from "@/lib/actions/documents";

type DocCategory =
  | "license"
  | "dea"
  | "cv"
  | "malpractice"
  | "caqh"
  | "payer_letter"
  | "contract"
  | "denial"
  | "info_request"
  | "internal_staging"
  | "other";

type OwnerType = "provider" | "enrollment" | "group_entity" | "client";

type DocRow = {
  id: string;
  file_name: string;
  category: DocCategory;
  size_bytes: number;
  mime_type: string;
  expiration_date: string | null;
  is_internal: boolean;
  virus_scan_status: string;
  created_at: string;
};

const CATEGORY_LABELS: Record<DocCategory, string> = {
  license: "License",
  dea: "DEA",
  cv: "CV",
  malpractice: "Malpractice",
  caqh: "CAQH",
  payer_letter: "Payer letter",
  contract: "Contract",
  denial: "Denial letter",
  info_request: "Info request",
  internal_staging: "Internal staging",
  other: "Other",
};

const HAS_EXPIRATION: ReadonlySet<DocCategory> = new Set([
  "license",
  "dea",
  "malpractice",
  "caqh",
]);

export function DocumentsPanel({
  clientId,
  ownerType,
  ownerId,
  documents,
  canManage,
  defaultCategory,
}: {
  clientId: string;
  ownerType: OwnerType;
  ownerId: string;
  documents: DocRow[];
  /** True if the viewer is an admin and can upload/delete; false for client_users (read-only). */
  canManage: boolean;
  /** Hint for the category dropdown's initial value, varies by owner type. */
  defaultCategory: DocCategory;
}) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<DocCategory>(defaultCategory);
  const [isInternal, setIsInternal] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((d) => (
            <DocRowItem key={d.id} doc={d} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage && !showForm && (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          + Upload document
        </Button>
      )}

      {canManage && showForm && (
        <form
          className="space-y-3 border-t pt-3"
          action={(formData) => {
            setError(null);
            formData.set("clientId", clientId);
            formData.set("ownerType", ownerType);
            formData.set("ownerId", ownerId);
            formData.set("category", category);
            formData.set("isInternal", String(isInternal));
            if (HAS_EXPIRATION.has(category) && expirationDate) {
              formData.set("expirationDate", expirationDate);
            } else {
              formData.delete("expirationDate");
            }
            startTransition(async () => {
              const result = await uploadDocumentAction(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setShowForm(false);
              setExpirationDate("");
              setIsInternal(false);
            });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="doc-file" className="text-xs">
              File (PDF, image, doc — max 50 MB)
            </Label>
            <Input id="doc-file" name="file" type="file" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="doc-category" className="text-xs">
                Category
              </Label>
              <select
                id="doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            {HAS_EXPIRATION.has(category) && (
              <div className="space-y-1">
                <Label htmlFor="doc-expiration" className="text-xs">
                  Expiration date
                </Label>
                <Input
                  id="doc-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="doc-description" className="text-xs">
              Description (optional)
            </Label>
            <Input id="doc-description" name="description" maxLength={500} />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
            />
            <span>Internal-only (admins see; clients never see)</span>
          </label>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Uploading..." : "Upload"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function DocRowItem({ doc, canManage }: { doc: DocRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getDocumentDownloadUrlAction(doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Open in a new tab; the URL is signed for 60s.
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDocumentAction(doc.id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li
      className={`flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ${
        doc.is_internal ? "border-amber-300 bg-amber-50/40" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="truncate text-left font-medium text-primary hover:underline disabled:opacity-50"
          >
            {doc.file_name}
          </button>
          {doc.is_internal && (
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
              Internal
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[doc.category]} · {formatBytes(doc.size_bytes)} ·{" "}
          {format(new Date(doc.created_at), "PP")}
          {doc.expiration_date && (
            <> · expires {format(new Date(doc.expiration_date), "PP")}</>
          )}
        </p>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="ml-3 text-xs text-destructive hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </li>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
