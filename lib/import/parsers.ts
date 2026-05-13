import "server-only";
import ExcelJS from "exceljs";
import type { ImportEntityType } from "./types";

const MAX_ROWS = 5000;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** A row's raw cell values, keyed by the canonical column id. */
export type RawRow = {
  rowNumber: number;
  values: Record<string, string>;
};

/**
 * Canonical column ids per entity. The first matching header cell in the
 * file (case- and whitespace-insensitive) maps to the column id.
 *
 * Aliases are conservative: only well-known column-name variations are
 * accepted to avoid silently mapping the wrong column.
 */
const COLUMN_DEFS: Record<
  ImportEntityType,
  Record<string, string[] /* aliases */>
> = {
  enrollments: {
    states: ["states", "state", "us state", "states active"],
    payers: ["payers", "payer", "payer name", "insurance", "insurance carrier"],
    status: [
      "participation request status",
      "status",
      "participation status",
      "request status",
      "credentialing status",
    ],
    comments: ["comments", "notes", "remarks", "sub status", "sub-status"],
  },
  clients: {
    firstName: ["first name", "first", "firstname", "given name"],
    middleName: ["middle name", "middle", "middlename"],
    lastName: ["last name", "last", "lastname", "surname", "family name"],
    suffix: ["suffix", "credentials"],
    npi: ["npi", "npi number", "national provider identifier"],
    primarySpecialty: ["primary specialty", "specialty", "specialty 1"],
    secondarySpecialty: ["secondary specialty", "specialty 2"],
    email: ["email", "email address"],
    phone: ["phone", "phone number", "telephone"],
    caqhId: ["caqh id", "caqh", "caqh number"],
  },
  organizations: {
    legalName: ["legal name", "legal entity name", "organization legal name"],
    displayName: ["display name", "display", "common name", "doing business as", "dba"],
    primaryContactName: ["primary contact name", "contact name", "contact"],
    primaryContactEmail: ["primary contact email", "contact email", "email"],
    primaryContactPhone: ["primary contact phone", "contact phone", "phone"],
    notes: ["notes", "remarks"],
  },
};

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

/**
 * Parse an uploaded xlsx file for the given entity type. Returns the rows
 * keyed by the canonical column id. The header row is auto-detected within
 * the first 10 rows.
 *
 * Caps: file size ≤ 5 MB, row count ≤ 5000. Files exceeding either are
 * rejected with an ImportParseError.
 */
export async function parseXlsx(
  file: File,
  entity: ImportEntityType,
): Promise<RawRow[]> {
  if (file.size === 0) throw new ImportParseError("File is empty.");
  if (file.size > MAX_BYTES) {
    throw new ImportParseError(
      `File too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB).`,
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    throw new ImportParseError(
      `Could not read file as xlsx: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportParseError("Workbook has no sheets.");

  const columnDef = COLUMN_DEFS[entity];
  const headerMatch = detectHeader(sheet, columnDef);
  if (!headerMatch) {
    throw new ImportParseError(
      `Could not find header row. Expected at least one of: ${formatExpectedColumns(columnDef)}.`,
    );
  }

  const { headerRowNumber, columnMap } = headerMatch;
  const rows: RawRow[] = [];

  // Iterate rows below the header.
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    if (rows.length >= MAX_ROWS) {
      throw new ImportParseError(
        `Too many rows (max ${MAX_ROWS}). Split the file and import in chunks.`,
      );
    }
    const row = sheet.getRow(r);
    const values: Record<string, string> = {};
    let hasAny = false;
    for (const [canonicalId, colIndex] of Object.entries(columnMap)) {
      const cellValue = row.getCell(colIndex).value;
      const stringified = cellToString(cellValue);
      if (stringified.length > 0) hasAny = true;
      values[canonicalId] = stringified;
    }
    // Skip fully-empty rows. Some templates have trailing blank rows.
    if (!hasAny) continue;
    rows.push({ rowNumber: r - headerRowNumber, values });
  }

  return rows;
}

/**
 * Scan the first 10 rows of a sheet for a row that contains at least one
 * recognized header alias for each REQUIRED column. Returns the header row
 * number (1-based) and a canonical-id → 1-based-column-index map.
 *
 * "Required" here means: every key in the column def must be matched.
 * (The enrollments template's "Comments" column is optional in real files
 * but the parser still maps it if present.)
 */
function detectHeader(
  sheet: ExcelJS.Worksheet,
  columnDef: Record<string, string[]>,
): { headerRowNumber: number; columnMap: Record<string, number> } | null {
  const maxScan = Math.min(10, sheet.rowCount);
  for (let r = 1; r <= maxScan; r++) {
    const row = sheet.getRow(r);
    const cells: Array<{ index: number; norm: string }> = [];
    row.eachCell((cell, colNumber) => {
      const text = cellToString(cell.value).toLowerCase().trim();
      if (text.length > 0) cells.push({ index: colNumber, norm: text });
    });
    if (cells.length === 0) continue;

    const columnMap: Record<string, number> = {};
    for (const [canonicalId, aliases] of Object.entries(columnDef)) {
      const aliasSet = new Set(aliases.map((a) => a.toLowerCase()));
      const hit = cells.find((c) => aliasSet.has(c.norm));
      if (hit) columnMap[canonicalId] = hit.index;
    }

    // We require ALL canonical columns to be present (except notes/comments
    // which are optional). If everything required is mapped, this is the
    // header row.
    const required = Object.keys(columnDef).filter(
      (k) => k !== "comments" && k !== "notes" && k !== "middleName" && k !== "suffix",
    );
    const allRequiredFound = required.every((k) => columnMap[k]);
    if (allRequiredFound) {
      return { headerRowNumber: r, columnMap };
    }
  }
  return null;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value && "text" in value) {
    // Rich text or formula result with embedded text.
    return String((value as { text: string }).text ?? "").trim();
  }
  if (typeof value === "object" && value && "result" in value) {
    // Formula cell — use the cached result.
    return cellToString((value as { result: ExcelJS.CellValue }).result);
  }
  return String(value).trim();
}

function formatExpectedColumns(columnDef: Record<string, string[]>): string {
  return Object.values(columnDef)
    .map((aliases) => `"${aliases[0]}"`)
    .join(", ");
}
