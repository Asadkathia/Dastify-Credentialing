"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  previewImportAction,
  commitImportAction,
  type ImportCommitResult,
  type ImportPreviewResult,
} from "@/lib/actions/import";
import type {
  ImportEntityType,
  ImportPreviewRow,
  ParsedClientRow,
  ParsedEnrollmentRow,
  ParsedOrganizationRow,
} from "@/lib/import/types";
import type { OrganizationKind } from "@/db/schema/organizations";

export type OrgOption = { id: string; displayName: string; kind: OrganizationKind };
export type ClientOption = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
};

export type ImportFlowProps = {
  entity: ImportEntityType;
  organizations: OrgOption[];
  clients: ClientOption[];
};

type Stage = "form" | "previewing" | "preview" | "committing" | "result" | "error";

type AnyParsedRow = ParsedEnrollmentRow | ParsedClientRow | ParsedOrganizationRow;

export function ImportFlow({
  entity,
  organizations,
  clients,
}: ImportFlowProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult<AnyParsedRow> | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId),
    [organizations, organizationId],
  );
  const orgKind: OrganizationKind | undefined = selectedOrg?.kind;

  const orgClients = useMemo(
    () => clients.filter((c) => c.organizationId === organizationId),
    [clients, organizationId],
  );

  const needsOrg = entity === "enrollments" || entity === "clients";
  const needsSubject = entity === "enrollments";
  // For Individual orgs the server resolves the singleton clinician — no UI picker.
  const needsClientPicker = needsSubject && orgKind === "group";

  function buildFormData(f: File): FormData {
    const fd = new FormData();
    fd.set("entity", entity);
    fd.set("file", f);
    if (needsOrg) fd.set("organizationId", organizationId);
    if (needsClientPicker) fd.set("clientId", clientId);
    return fd;
  }

  function onPreview(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!file) {
      setErrorMessage("Pick a file to upload.");
      return;
    }
    if (needsOrg && !organizationId) {
      setErrorMessage("Select an organization.");
      return;
    }
    if (needsClientPicker && !clientId) {
      setErrorMessage("Select a client (clinician).");
      return;
    }

    setStage("previewing");
    startTransition(async () => {
      const res = await previewImportAction(buildFormData(file));
      if (!res.ok) {
        setErrorMessage(res.error);
        setStage("form");
        return;
      }
      setPreview(res.data as ImportPreviewResult<AnyParsedRow>);
      setStage("preview");
    });
  }

  function onCommit() {
    if (!file) return;
    setErrorMessage(null);
    setStage("committing");
    startTransition(async () => {
      const res = await commitImportAction(buildFormData(file));
      if (!res.ok) {
        setErrorMessage(res.error);
        setStage("preview");
        return;
      }
      setResult(res.data);
      setStage("result");
      router.refresh();
    });
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setErrorMessage(null);
    setStage("form");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <a
          href={`/api/import/template/${entity}`}
          className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
        >
          <Download size={13} strokeWidth={1.7} />
          Download {entity} template
        </a>
      </header>

      {stage === "form" || stage === "previewing" ? (
        <form
          onSubmit={onPreview}
          className="surface flex flex-col gap-5 px-6 py-5"
          aria-busy={stage === "previewing"}
        >
          {needsOrg ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="imp-orgId"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                Organization
              </label>
              <select
                id="imp-orgId"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setClientId("");
                }}
                disabled={stage === "previewing"}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none"
              >
                <option value="">Select organization…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {needsSubject && orgKind === "individual" ? (
            <p className="rounded-md bg-lightgrey px-3 py-2 text-[12px] text-navy/65">
              This will be enrolled for the practice&apos;s clinician.
            </p>
          ) : null}

          {needsClientPicker ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="imp-clientId"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
              >
                Client (clinician)
              </label>
              <select
                id="imp-clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={stage === "previewing" || !organizationId}
                required
                className="h-9 rounded-md border border-border-subtle bg-white px-2.5 text-[13px] focus-visible:border-teal focus-visible:outline-none disabled:bg-lightgrey"
              >
                <option value="">
                  {organizationId ? "Select client…" : "Pick an organization first"}
                </option>
                {orgClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName}, {c.firstName}
                    {c.middleName ? ` ${c.middleName[0]}.` : ""}
                    {c.suffix ? `, ${c.suffix}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="imp-file"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/65"
            >
              File (.xlsx, max 5 MB)
            </label>
            <input
              id="imp-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={stage === "previewing"}
              required
              className="text-[13px]"
            />
            {file ? (
              <p className="text-[11px] text-navy/55">
                <FileSpreadsheet size={11} className="inline mr-1" />
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
            <Button type="submit" disabled={stage === "previewing"}>
              <Upload size={14} strokeWidth={1.6} className="mr-1.5" />
              {stage === "previewing" ? "Parsing…" : "Parse + preview"}
            </Button>
          </div>
        </form>
      ) : null}

      {(stage === "preview" || stage === "committing") && preview ? (
        <PreviewView
          preview={preview}
          committing={stage === "committing"}
          errorMessage={errorMessage}
          onCommit={onCommit}
          onCancel={reset}
        />
      ) : null}

      {stage === "result" && result ? <ResultView result={result} onAgain={reset} /> : null}
    </div>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

function PreviewView({
  preview,
  committing,
  errorMessage,
  onCommit,
  onCancel,
}: {
  preview: ImportPreviewResult<AnyParsedRow>;
  committing: boolean;
  errorMessage: string | null;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { summary, rows } = preview;
  const canCommit = summary.validRows > 0 && !committing;

  // Get headers from the first row's raw values (canonical column ids).
  const columnIds = rows[0] ? Object.keys(rows[0].raw) : [];

  return (
    <div className="surface flex flex-col">
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-navy">Preview · {preview.fileName}</h2>
            <p className="mt-0.5 text-[12px] text-navy/55">
              Confirming inserts only the valid rows. Errors and duplicates are skipped.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SummaryPill label="Valid" count={summary.validRows} tone="success" />
            <SummaryPill label="Skip" count={summary.duplicateRows} tone="muted" />
            <SummaryPill label="Error" count={summary.errorRows} tone="danger" />
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-[60px]">#</th>
              <th className="w-[100px]">Status</th>
              {columnIds.map((id) => (
                <th key={id}>{id}</th>
              ))}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnIds.length + 3} className="px-5 py-6 text-center text-navy/55">
                  No data rows found below the header.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => <PreviewRow key={idx} row={r} columnIds={columnIds} />)
            )}
          </tbody>
        </table>
      </div>

      {errorMessage ? (
        <p className="border-t border-border-subtle bg-danger-08 px-5 py-3 text-[12px] text-danger">
          {errorMessage}
        </p>
      ) : null}

      <footer className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={committing}>
          Cancel
        </Button>
        <Button type="button" onClick={onCommit} disabled={!canCommit}>
          {committing
            ? "Inserting…"
            : `Confirm + insert ${summary.validRows} row${summary.validRows === 1 ? "" : "s"}`}
        </Button>
      </footer>
    </div>
  );
}

function PreviewRow({
  row,
  columnIds,
}: {
  row: ImportPreviewRow<AnyParsedRow>;
  columnIds: string[];
}) {
  const tone =
    row.status === "valid"
      ? "bg-success-08 text-[#1B5E20]"
      : row.status === "duplicate"
        ? "bg-navy-04 text-navy/65"
        : "bg-danger-08 text-danger";
  const icon =
    row.status === "valid" ? (
      <Check size={12} strokeWidth={2} />
    ) : row.status === "duplicate" ? (
      <AlertCircle size={12} strokeWidth={2} />
    ) : (
      <XCircle size={12} strokeWidth={2} />
    );
  return (
    <tr>
      <td className="tnum text-[11px] text-navy/55">{row.rowNumber}</td>
      <td>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] " +
            tone
          }
        >
          {icon}
          {row.status}
        </span>
      </td>
      {columnIds.map((id) => (
        <td key={id} className="text-[12px] text-navy/85">
          {row.raw[id] || <span className="text-navy/35">—</span>}
        </td>
      ))}
      <td className="text-[12px] text-navy/65">{row.message ?? ""}</td>
    </tr>
  );
}

function SummaryPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "success" | "muted" | "danger";
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] " +
    (tone === "success"
      ? "bg-success-08 text-[#1B5E20]"
      : tone === "danger"
        ? "bg-danger-08 text-danger"
        : "bg-navy-04 text-navy/65");
  return (
    <span className={className}>
      {label}
      <span className="tnum text-[13px]">{count}</span>
    </span>
  );
}

// ── Result ───────────────────────────────────────────────────────────────────

function ResultView({ result, onAgain }: { result: ImportCommitResult; onAgain: () => void }) {
  const errorCsvHref = result.errors.length > 0 ? buildErrorCsvHref(result.errors) : null;

  return (
    <div className="surface flex flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
        <CheckCircle2 size={24} className="text-success" />
        <div>
          <h2 className="text-[15px] font-semibold text-navy">Import complete</h2>
          <p className="text-[12px] text-navy/55">
            Inserted{" "}
            <span className="tnum font-semibold text-navy">{result.insertedCount}</span>{" "}
            {result.entity}.
          </p>
        </div>
      </header>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <StatPanel label="Inserted" value={result.insertedCount} tone="success" />
        <StatPanel label="Skipped (duplicates)" value={result.skippedCount} tone="muted" />
        <StatPanel label="Errors" value={result.errorCount} tone="danger" />
      </div>
      {errorCsvHref ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <a
            href={errorCsvHref}
            download="import-errors.csv"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal hover:text-[#0E7475]"
          >
            <Download size={13} strokeWidth={1.7} />
            Download error CSV ({result.errors.length} rows)
          </a>
        </div>
      ) : null}
      <footer className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-4">
        <Button type="button" variant="ghost" onClick={onAgain}>
          Import another file
        </Button>
      </footer>
    </div>
  );
}

function StatPanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "muted" | "danger";
}) {
  const wrap =
    "rounded-md border px-4 py-3 " +
    (tone === "success"
      ? "border-success/20 bg-success-08"
      : tone === "danger"
        ? "border-danger/20 bg-danger-08"
        : "border-border-subtle bg-lightgrey");
  return (
    <div className={wrap}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy/55">{label}</p>
      <p className="mt-1 text-[24px] font-bold leading-none tnum text-navy">{value}</p>
    </div>
  );
}

function buildErrorCsvHref(errors: ImportCommitResult["errors"]): string {
  const header = "row_number,message";
  const body = errors
    .map(
      (e) =>
        `${e.rowNumber},"${e.message.replace(/"/g, '""')}"`,
    )
    .join("\n");
  const csv = `${header}\n${body}\n`;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}
