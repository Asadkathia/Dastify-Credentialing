import type { EnrollmentStatus } from "@/db/schema/enums";

/** A row's outcome after parsing + validation. */
export type ImportRowStatus = "valid" | "error" | "duplicate";

/** A single row inside a preview, after parse + validate + duplicate check. */
export type ImportPreviewRow<TParsed> = {
  /** 1-based row number in the source file (counting from the header row). */
  rowNumber: number;
  status: ImportRowStatus;
  /** Raw cell values for display in the preview UI. */
  raw: Record<string, string>;
  /** Parsed, validated, normalized data. Null when status !== "valid". */
  parsed: TParsed | null;
  /** Human-readable error/skip explanation when status !== "valid". */
  message: string | null;
};

/** Summary returned alongside the row list. */
export type ImportPreviewSummary = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
};

export type ImportEntityType = "enrollments" | "clients" | "organizations";

// ── Per-entity parsed shapes ─────────────────────────────────────────────────

export type ParsedEnrollmentRow = {
  /** 2-letter US state code, uppercase. */
  state: string;
  /** UUID of an existing payer (resolved from the file's payer name). */
  payerId: string;
  /** Display name of the resolved payer (echoed in the preview). */
  payerName: string;
  status: EnrollmentStatus;
  subStatus: string | null;
};

export type ParsedClientRow = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  npi: string | null;
  primarySpecialty: string | null;
  secondarySpecialty: string | null;
  email: string | null;
  phone: string | null;
  caqhId: string | null;
};

export type ParsedOrganizationRow = {
  legalName: string;
  displayName: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  notes: string | null;
};
