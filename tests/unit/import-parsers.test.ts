import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseXlsx, ImportParseError } from "@/lib/import/parsers";

// ── Helpers ────────────────────────────────────────────────────────────────

async function workbookToFile(wb: ExcelJS.Workbook, name = "test.xlsx"): Promise<File> {
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf as ArrayBuffer], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// Mirrors the real customer template format: merged-banner row 1,
// blank styled row 2, header row 3 with Alt+Enter line break inside
// "Participation\nRequest Status". Followed by N data rows.
async function buildCustomerTemplate(
  dataRows: Array<[states: string, payers: string, status: string, comments: string]>,
): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet 1");
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = "All Insurances take upto 90-120 business days for processing.";
  ws.mergeCells("A2:B2");
  ws.mergeCells("C2:D2");
  const header = ws.getRow(3);
  header.values = ["States", "Payers", "Participation\nRequest Status", "Comments"];
  for (let i = 0; i < dataRows.length; i++) {
    ws.getRow(4 + i).values = dataRows[i]!;
  }
  return workbookToFile(wb);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("parseXlsx — header detection is whitespace-flexible", () => {
  it("parses the real customer template (banner row + blank row + header with \\n inside)", async () => {
    const file = await buildCustomerTemplate([
      ["TX", "Aetna", "Submitted", "First note"],
      ["NM", "Aetna", "Approved", ""],
    ]);

    const rows = await parseXlsx(file, "enrollments");

    expect(rows).toHaveLength(2);
    expect(rows[0]!.values).toMatchObject({
      states: "TX",
      payers: "Aetna",
      status: "Submitted",
      comments: "First note",
    });
    expect(rows[1]!.values).toMatchObject({
      states: "NM",
      payers: "Aetna",
      status: "Approved",
    });
  });

  it("matches headers with internal double-spaces", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet 1");
    ws.getRow(1).values = ["States", "Payers", "Participation  Request   Status", "Comments"];
    ws.getRow(2).values = ["TX", "Aetna", "Submitted", ""];

    const rows = await parseXlsx(await workbookToFile(wb), "enrollments");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.values.status).toBe("Submitted");
  });

  it("matches headers with tabs inside", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet 1");
    ws.getRow(1).values = ["States", "Payers", "Participation\tRequest\tStatus", "Comments"];
    ws.getRow(2).values = ["TX", "Aetna", "Submitted", ""];

    const rows = await parseXlsx(await workbookToFile(wb), "enrollments");
    expect(rows).toHaveLength(1);
  });

  it("skips fully-empty trailing rows", async () => {
    const file = await buildCustomerTemplate([
      ["TX", "Aetna", "Submitted", ""],
    ]);
    // buildCustomerTemplate already leaves rows 5+ empty in the worksheet
    // because ExcelJS tracks rowCount based on the highest accessed row;
    // we rely on parser to skip them.
    const rows = await parseXlsx(file, "enrollments");
    expect(rows).toHaveLength(1);
  });

  it("throws ImportParseError when no header row is found in the first 10 rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet 1");
    ws.getRow(1).values = ["nothing", "here", "matches", "anything"];
    ws.getRow(2).values = ["nor", "does", "this", "row"];

    await expect(parseXlsx(await workbookToFile(wb), "enrollments")).rejects.toBeInstanceOf(
      ImportParseError,
    );
  });

  it("returns zero rows when the customer template is uploaded with no data filled in", async () => {
    const file = await buildCustomerTemplate([]);
    const rows = await parseXlsx(file, "enrollments");
    expect(rows).toEqual([]);
  });
});
