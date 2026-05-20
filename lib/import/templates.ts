import "server-only";
import ExcelJS from "exceljs";
import type { ImportEntityType } from "./types";
import { TEMPLATE_SPECS } from "./template-spec";

/**
 * Generate a downloadable xlsx template for the given import entity.
 *
 * Each template has:
 *   Row 1: a yellow instruction banner spanning all columns
 *   Row 2: the canonical header (the parser detects this row regardless of
 *          its position in the first 10 rows of the sheet)
 *   Row 3: a single example row
 *
 * Admins can append rows below row 3. Empty rows at the end are skipped.
 *
 * The visual preview component renders the same column definitions
 * (see `lib/import/template-spec.ts`).
 */
export async function buildImportTemplateXlsx(
  entity: ImportEntityType,
): Promise<Uint8Array> {
  const spec = TEMPLATE_SPECS[entity];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dastify Connect";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Import ${entity}`, {
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = spec.columns.map((c) => ({ width: c.width }));

  // Row 1: banner spanning all columns.
  ws.mergeCells(1, 1, 1, spec.columns.length);
  const bannerCell = ws.getCell(1, 1);
  bannerCell.value = spec.banner;
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
  headerRow.values = spec.columns.map((c) => c.header);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });

  // Row 3: example.
  ws.getRow(3).values = spec.columns.map((c) => c.example);
  ws.getRow(3).font = { color: { argb: "FF9CA3AF" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
