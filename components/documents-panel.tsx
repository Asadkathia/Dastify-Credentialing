"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Download, FileText, Lock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadDocumentAction,
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
  createDocumentCategoryAction,
} from "@/lib/actions/documents";

type OwnerType = "provider" | "enrollment" | "client";

export type DocCategory = {
  id: string;
  name: string;
  label: string;
  is_default: boolean;
};

export type DocRow = {
  id: string;
  file_name: string;
  category_id: string;
  category: DocCategory | DocCategory[] | null;
  size_bytes: number;
  mime_type: string;
  expiration_date: string | null;
  is_internal: boolean;
  virus_scan_status: string;
  created_at: string;
};

// Categories whose docs typically have an expiration date.
const EXPIRATION_CATEGORY_NAMES: ReadonlySet<string> = new Set([
  "license",
  "dea",
  "malpractice",
  "caqh",
]);

// Brand-aligned chip tint by built-in category name. Custom categories fall back
// to neutral lightgrey.
const CHIP_CLASSES_BY_NAME: Record<string, string> = {
  license: "bg-teal-08 text-navy",
  dea: "bg-navy-08 text-navy",
  cv: "bg-lightgrey text-navy/65",
  malpractice: "bg-danger-08 text-danger",
  caqh: "bg-teal-08 text-navy",
  payer_letter: "bg-success-08 text-[#1B5E20]",
  contract: "bg-success-08 text-[#1B5E20]",
  denial: "bg-danger-08 text-danger",
  info_request: "bg-warning-08 text-[#7a4f00]",
  internal_staging: "bg-warning-08 text-[#7a4f00]",
  other: "bg-lightgrey text-navy/65",
};
const FALLBACK_CHIP = "bg-lightgrey text-navy/65";

const labelClasses = "text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/70";
const selectClasses =
  "mt-2 flex h-9 w-full rounded-sm border border-border-subtle bg-white px-3 py-1 text-[13px] text-charcoal focus-visible:border-teal focus-visible:outline-none";
const inputClasses = "mt-2 bg-white text-[13px]";

function chipClassFor(name: string | undefined): string {
  return name && CHIP_CLASSES_BY_NAME[name] ? CHIP_CLASSES_BY_NAME[name] : FALLBACK_CHIP;
}

function asCategory(value: DocRow["category"]): DocCategory | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function DocumentsPanel({
  organizationId,
  ownerType,
  ownerId,
  documents,
  categories: initialCategories,
  canManage,
  defaultCategoryName,
}: {
  organizationId: string;
  ownerType: OwnerType;
  ownerId: string;
  documents: DocRow[];
  categories: DocCategory[];
  canManage: boolean;
  defaultCategoryName: string;
}) {
  const [categories, setCategories] = useState<DocCategory[]>(initialCategories);
  const initialCat =
    initialCategories.find((c) => c.name === defaultCategoryName) ?? initialCategories[0];

  const [showForm, setShowForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCat?.id ?? "");
  const [isInternal, setIsInternal] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [addingCategory, startAddingCategory] = useTransition();

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const showExpirationField =
    selectedCategory && EXPIRATION_CATEGORY_NAMES.has(selectedCategory.name);

  function handleAddCategory() {
    setError(null);
    if (newCategoryLabel.trim().length < 2) {
      setError("Category name must be at least 2 characters");
      return;
    }
    startAddingCategory(async () => {
      const result = await createDocumentCategoryAction({ label: newCategoryLabel.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const newCat: DocCategory = {
        id: result.data.id,
        name: result.data.name,
        label: result.data.label,
        is_default: false,
      };
      setCategories((prev) => {
        const without = prev.filter((c) => c.id !== newCat.id);
        const next = [...without, newCat];
        return next.sort((a, b) => {
          if (a.name === "other") return 1;
          if (b.name === "other") return -1;
          return a.label.localeCompare(b.label);
        });
      });
      setSelectedCategoryId(newCat.id);
      setShowAddCategory(false);
      setNewCategoryLabel("");
    });
  }

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md bg-lightgrey px-4 py-3 text-[13px] text-navy/55">
          <FileText size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-teal" />
          <p>No documents yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <DocRowItem key={d.id} doc={d} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage && !showForm ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Upload size={12} strokeWidth={1.6} className="mr-1.5" />
          Upload document
        </Button>
      ) : null}

      {canManage && showForm ? (
        <form
          className="space-y-4 border-t border-border-subtle pt-4"
          action={(formData) => {
            setError(null);
            formData.set("organizationId", organizationId);
            formData.set("ownerType", ownerType);
            formData.set("ownerId", ownerId);
            formData.set("categoryId", selectedCategoryId);
            formData.set("isInternal", String(isInternal));
            if (showExpirationField && expirationDate) {
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
          <div>
            <Label htmlFor="doc-file" className={labelClasses}>
              File (PDF, image, doc — max 50 MB)
            </Label>
            <Input id="doc-file" name="file" type="file" required className={inputClasses} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="doc-category" className={labelClasses}>
                Category
              </Label>
              <select
                id="doc-category"
                value={selectedCategoryId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__add_new__") {
                    setShowAddCategory(true);
                    return;
                  }
                  setSelectedCategoryId(v);
                  setShowAddCategory(false);
                }}
                className={selectClasses}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
                <option value="__add_new__">+ Other (add new category)…</option>
              </select>
            </div>

            {showExpirationField ? (
              <div>
                <Label htmlFor="doc-expiration" className={labelClasses}>
                  Expiration date
                </Label>
                <Input
                  id="doc-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className={`${inputClasses} tnum`}
                />
              </div>
            ) : null}
          </div>

          {showAddCategory ? (
            <div className="rounded-md border border-teal/30 bg-teal-08 p-4">
              <Label htmlFor="new-cat-label" className={labelClasses}>
                New category label
              </Label>
              <Input
                id="new-cat-label"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder="e.g. Wellness Form"
                maxLength={60}
                className={inputClasses}
              />
              <p className="mt-1 text-[11px] text-navy/55">
                Saved to the global category list — visible to all admins.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={addingCategory || newCategoryLabel.trim().length < 2}
                >
                  {addingCategory ? "Adding…" : "Add category"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryLabel("");
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="doc-description" className={labelClasses}>
              Description (optional)
            </Label>
            <Input id="doc-description" name="description" maxLength={500} className={inputClasses} />
          </div>

          <label className="flex items-center gap-2 text-[12px] text-charcoal">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-3.5 w-3.5 rounded-sm accent-navy"
            />
            <span>Internal-only (admins see; clients never see)</span>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending || !selectedCategoryId}>
              {pending ? "Uploading…" : "Upload"}
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
      ) : null}
    </div>
  );
}

function DocRowItem({ doc, canManage }: { doc: DocRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cat = asCategory(doc.category);

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getDocumentDownloadUrlAction(doc.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
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
      className={
        "flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2.5 text-[13px] shadow-[var(--shadow-xs)] " +
        (doc.is_internal ? "border-warning/30" : "border-border-subtle")
      }
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-lightgrey text-teal"
      >
        <FileText size={16} strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {cat ? (
            <span
              className={
                "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
                chipClassFor(cat.name)
              }
            >
              {cat.label}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="flex items-center gap-1.5 truncate text-left font-medium text-navy hover:text-teal disabled:opacity-50"
          >
            {doc.file_name}
            <Download size={11} strokeWidth={1.6} className="shrink-0 text-navy/45" />
          </button>
          {doc.is_internal ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-warning-08 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#7a4f00]">
              <Lock size={10} strokeWidth={1.6} />
              Internal
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 tnum text-[11px] text-navy/55">
          {formatBytes(doc.size_bytes)} · {format(new Date(doc.created_at), "PP")}
          {doc.expiration_date ? (
            <> · expires {format(new Date(doc.expiration_date), "PP")}</>
          ) : null}
        </p>
        {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label={`Delete ${doc.file_name}`}
          className="shrink-0 rounded-sm p-1.5 text-navy/40 transition-colors hover:bg-danger-08 hover:text-danger disabled:opacity-50"
        >
          <Trash2 size={14} strokeWidth={1.6} />
        </button>
      ) : null}
    </li>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
