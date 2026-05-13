import "server-only";
import ExcelJS from "exceljs";
import type { ImportEntityType } from "./types";

/**
 * Generate a downloadable xlsx template for the given import entity.
 *
 * Each template has:
 *   Row 1: a yellow instruction banner explaining what to put in each column
 *   Row 2: the canonical header (the parser detects this row regardless of
 *          its position in the first 10 rows of the sheet)
 *   Row 3: a single example row
 *
 * Admins can append rows below row 3. Empty rows at the end are skipped.
 */
export async function buildImportTemplateXlsx(
  entity: ImportEntityType,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dastify Credentialing Portal";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Import ${entity}`, {
    properties: { defaultRowHeight: 18 },
  });

  const { headers, example, banner, widths } = SPECS[entity];

  ws.columns = widths.map((w) => ({ width: w }));

  // Row 1: banner spanning all columns.
  ws.mergeCells(1, 1, 1, headers.length);
  const bannerCell = ws.getCell(1, 1);
  bannerCell.value = banner;
  bannerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  bannerCell.font = { italic: true, color: { argb: "FF7A4F00" } };
  bannerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };
  ws.getRow(1).height = 40;

  // Row 2: header.
  const headerRow = ws.getRow(2);
  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });

  // Row 3: example.
  ws.getRow(3).values = example;
  ws.getRow(3).font = { color: { argb: "FF9CA3AF" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

const SPECS: Record<
  ImportEntityType,
  { headers: string[]; example: (string | number)[]; banner: string; widths: number[] }
> = {
  enrollments: {
    headers: ["States", "Payers", "Participation Request Status", "Comments"],
    example: ["TX, NM", "Aetna", "Submitted", "CAQH attestation pending"],
    banner:
      "Bulk-import enrollments for one Client (clinician) or Group entity under one Organization. The States cell may list multiple US codes/names separated by commas, semicolons, slashes, or newlines — each becomes its own enrollment row. Status accepts the 5 enum values plus common aliases (Approved/Effective/Active map to approved; Non-Par/Non-Par Credentialed map to non_par_credentialed).",
    widths: [12, 30, 30, 50],
  },
  clients: {
    headers: [
      "First Name",
      "Middle Name",
      "Last Name",
      "Suffix",
      "NPI",
      "Primary Specialty",
      "Secondary Specialty",
      "Email",
      "Phone",
      "CAQH ID",
    ],
    example: [
      "Imran",
      "",
      "Khan",
      "MD",
      "1234567890",
      "Internal Medicine",
      "Endocrinology",
      "ikhan@example.com",
      "+1 512 555 0100",
      "12345678",
    ],
    banner:
      "Bulk-import individual clinicians under one Organization (select the org in the upload form before uploading). First Name + Last Name are required. NPI must be 10 digits when provided. Email must be a valid address.",
    widths: [14, 14, 14, 8, 14, 22, 22, 24, 18, 14],
  },
  organizations: {
    headers: [
      "Legal Name",
      "Display Name",
      "Primary Contact Name",
      "Primary Contact Email",
      "Primary Contact Phone",
      "Notes",
    ],
    example: [
      "Acme Health Practice LLC",
      "Acme Health",
      "Jane Doe",
      "jane@acme.example",
      "+1 512 555 0100",
      "Onboarded 2026-05-14",
    ],
    banner:
      "Bulk-import organizations (tenant practices that Dastify provides credentialing services to). Legal Name + Display Name are required (both ≥ 2 characters). Duplicates are detected by Legal Name (case-insensitive).",
    widths: [28, 22, 22, 26, 18, 30],
  },
};
