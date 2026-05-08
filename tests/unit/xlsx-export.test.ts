import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildEnrollmentsXlsx } from "@/lib/export/xlsx";

describe(".xlsx export", () => {
  it("reproduces the template layout", async () => {
    const buf = await buildEnrollmentsXlsx({
      bannerText: "All Insurances take up to 90-120 business days for processing.",
      sheets: [
        {
          sheetName: "Smith, John",
          headerLeft: "Provider: John Smith (NPI 1234567890)",
          headerRight: "Generated: Jan 1, 2026",
          rows: [
            {
              state: "TX",
              payerName: "Aetna",
              status: "submitted",
              subStatus: "Awaiting CV",
              latestComment: "Need updated CV from provider",
            },
            {
              state: "NM",
              payerName: "Aetna",
              status: "in_review",
              subStatus: null,
              latestComment: null,
            },
          ],
        },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet("Smith, John");
    expect(ws).toBeDefined();
    if (!ws) return;

    expect(ws.getCell("A1").value).toContain("90-120 business days");
    expect(ws.getCell("A2").value).toContain("Provider:");
    expect(ws.getCell("C2").value).toContain("Generated:");
    expect(ws.getCell("A3").value).toBe("States");
    expect(ws.getCell("B3").value).toBe("Payers");
    expect(ws.getCell("C3").value).toBe("Participation Request Status");
    expect(ws.getCell("D3").value).toBe("Comments");
    expect(ws.getCell("A4").value).toBe("TX");
    expect(ws.getCell("B4").value).toBe("Aetna");
    expect(String(ws.getCell("C4").value)).toContain("Submitted");
    expect(String(ws.getCell("C4").value)).toContain("Awaiting CV");
    expect(ws.getCell("D4").value).toBe("Need updated CV from provider");
  });
});
