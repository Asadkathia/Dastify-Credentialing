import "server-only";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { STATUS_LABELS } from "@/lib/enrollment/state-machine";
import type { EnrollmentStatus } from "@/db/schema/enums";

/**
 * Reproduces the Dastify pre-portal Excel template:
 *   Row 1: disclaimer banner spanning A1:D1
 *   Row 2: "Provider: ___" (A2:B2 merged) | "Generated: ___" (C2:D2 merged)
 *   Row 3: column headers — States | Payers | Participation Request Status | Comments
 *   Row 4+: enrollment rows
 *
 * Multi-provider exports produce one sheet per provider. Group enrollments
 * get a "Group Entities" sheet.
 */

export type ExportRow = {
  state: string;
  payerName: string;
  status: EnrollmentStatus;
  subStatus: string | null;
  latestComment: string | null;
};

export type ExportSheet = {
  sheetName: string;
  headerLeft: string;
  headerRight: string;
  rows: ExportRow[];
};

export async function buildEnrollmentsXlsx({
  bannerText,
  sheets,
}: {
  bannerText: string;
  sheets: ExportSheet[];
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Dastify Connect";
  workbook.created = new Date();

  for (const sheetSpec of sheets) {
    const ws = workbook.addWorksheet(sheetSpec.sheetName, {
      properties: { defaultRowHeight: 18 },
    });

    ws.columns = [
      { width: 10 },
      { width: 36 },
      { width: 28 },
      { width: 60 },
    ];

    // Row 1: banner
    ws.mergeCells("A1:D1");
    const banner = ws.getCell("A1");
    banner.value = bannerText;
    banner.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    banner.font = { italic: true, color: { argb: "FF7A4F00" } };
    banner.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
    ws.getRow(1).height = 28;

    // Row 2: header context
    ws.mergeCells("A2:B2");
    ws.mergeCells("C2:D2");
    ws.getCell("A2").value = sheetSpec.headerLeft;
    ws.getCell("C2").value = sheetSpec.headerRight;
    ws.getCell("A2").font = { bold: true };
    ws.getCell("C2").font = { bold: true };
    ws.getCell("C2").alignment = { horizontal: "right" };

    // Row 3: column headers
    const headerRow = ws.getRow(3);
    headerRow.values = ["States", "Payers", "Participation Request Status", "Comments"];
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      };
    });

    // Data rows
    for (const row of sheetSpec.rows) {
      const statusText = `${STATUS_LABELS[row.status]}${row.subStatus ? ` — ${row.subStatus}` : ""}`;
      ws.addRow([row.state, row.payerName, statusText, row.latestComment ?? ""]);
    }

    // Light borders on data area
    const lastRow = ws.lastRow?.number ?? 3;
    for (let r = 4; r <= lastRow; r++) {
      ws.getRow(r).eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "hair", color: { argb: "FFE5E7EB" } },
        };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function defaultGeneratedHeader(now: Date = new Date()): string {
  return `Generated: ${format(now, "PPpp")}`;
}
