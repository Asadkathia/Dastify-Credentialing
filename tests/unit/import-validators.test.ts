import { describe, it, expect } from "vitest";
import {
  validateEnrollmentRow,
  validateClientRow,
  validateOrganizationRow,
  makeEnrollmentKey,
  type ValidateEnrollmentsContext,
} from "@/lib/import/validators";

const PAYER_AETNA = "00000000-0000-0000-0000-0000000000a1";
const PAYER_BCBS = "00000000-0000-0000-0000-0000000000b2";

function buildEnrollmentCtx(opts: {
  existingKeys?: string[];
} = {}): ValidateEnrollmentsContext {
  return {
    payersByName: new Map([
      ["aetna", { id: PAYER_AETNA, displayName: "Aetna" }],
      ["blue cross blue shield", { id: PAYER_BCBS, displayName: "Blue Cross Blue Shield" }],
    ]),
    existingKeys: new Set(opts.existingKeys ?? []),
  };
}

describe("validateEnrollmentRow", () => {
  it("returns a single valid row for a single-state cell", () => {
    const ctx = buildEnrollmentCtx();
    const out = validateEnrollmentRow(
      {
        rowNumber: 1,
        values: { states: "TX", payers: "Aetna", status: "Submitted", comments: "" },
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("valid");
    expect(out[0]!.parsed).toMatchObject({
      state: "TX",
      payerId: PAYER_AETNA,
      payerName: "Aetna",
      status: "submitted",
      subStatus: null,
    });
  });

  it("expands a multi-state cell into one row per state", () => {
    const ctx = buildEnrollmentCtx();
    const out = validateEnrollmentRow(
      {
        rowNumber: 2,
        values: {
          states: "TX, NM, CA",
          payers: "Aetna",
          status: "approved",
          comments: "Backdated",
        },
      },
      ctx,
    );
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.parsed?.state)).toEqual(["TX", "NM", "CA"]);
    expect(out.every((r) => r.status === "valid")).toBe(true);
    expect(out[0]!.parsed?.subStatus).toBe("Backdated");
  });

  it("flags unknown payer as an error", () => {
    const ctx = buildEnrollmentCtx();
    const out = validateEnrollmentRow(
      {
        rowNumber: 1,
        values: { states: "TX", payers: "Imagined Insurance Co", status: "prep", comments: "" },
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.status).toBe("error");
    expect(out[0]!.message).toMatch(/Unknown payer/);
  });

  it("flags unrecognized status as an error", () => {
    const ctx = buildEnrollmentCtx();
    const out = validateEnrollmentRow(
      {
        rowNumber: 1,
        values: { states: "TX", payers: "Aetna", status: "potato", comments: "" },
      },
      ctx,
    );
    expect(out[0]!.status).toBe("error");
    expect(out[0]!.message).toMatch(/Unrecognized status/);
  });

  it("flags unknown state in a multi-state cell as error for that state only", () => {
    const ctx = buildEnrollmentCtx();
    const out = validateEnrollmentRow(
      {
        rowNumber: 1,
        values: { states: "TX, XX, CA", payers: "Aetna", status: "prep", comments: "" },
      },
      ctx,
    );
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.status)).toEqual(["valid", "error", "valid"]);
  });

  it("flags existing (payer × state) as duplicate", () => {
    const ctx = buildEnrollmentCtx({
      existingKeys: [makeEnrollmentKey(PAYER_AETNA, "TX")],
    });
    const out = validateEnrollmentRow(
      {
        rowNumber: 1,
        values: { states: "TX", payers: "Aetna", status: "Submitted", comments: "" },
      },
      ctx,
    );
    expect(out[0]!.status).toBe("duplicate");
  });

  it("flags missing required fields", () => {
    const ctx = buildEnrollmentCtx();
    expect(
      validateEnrollmentRow(
        { rowNumber: 1, values: { states: "", payers: "Aetna", status: "prep", comments: "" } },
        ctx,
      )[0]!.status,
    ).toBe("error");
    expect(
      validateEnrollmentRow(
        { rowNumber: 1, values: { states: "TX", payers: "", status: "prep", comments: "" } },
        ctx,
      )[0]!.status,
    ).toBe("error");
    expect(
      validateEnrollmentRow(
        { rowNumber: 1, values: { states: "TX", payers: "Aetna", status: "", comments: "" } },
        ctx,
      )[0]!.status,
    ).toBe("error");
  });

  it("deduplicates within the same file", () => {
    // Two rows with same payer+state in one upload — first is valid, second is duplicate.
    const ctx = buildEnrollmentCtx();
    const r1 = validateEnrollmentRow(
      { rowNumber: 1, values: { states: "TX", payers: "Aetna", status: "prep", comments: "" } },
      ctx,
    );
    const r2 = validateEnrollmentRow(
      { rowNumber: 2, values: { states: "TX", payers: "Aetna", status: "prep", comments: "" } },
      ctx,
    );
    expect(r1[0]!.status).toBe("valid");
    expect(r2[0]!.status).toBe("duplicate");
  });
});

describe("validateClientRow", () => {
  it("accepts a minimal valid row", () => {
    const out = validateClientRow(
      { rowNumber: 1, values: { firstName: "Imran", lastName: "Khan" } },
      { existingNpis: new Set() },
    );
    expect(out.status).toBe("valid");
    expect(out.parsed).toMatchObject({ firstName: "Imran", lastName: "Khan", npi: null });
  });

  it("rejects missing first or last name", () => {
    const ctx = { existingNpis: new Set<string>() };
    expect(
      validateClientRow({ rowNumber: 1, values: { firstName: "", lastName: "Khan" } }, ctx).status,
    ).toBe("error");
    expect(
      validateClientRow({ rowNumber: 1, values: { firstName: "Imran", lastName: "" } }, ctx).status,
    ).toBe("error");
  });

  it("rejects malformed NPI", () => {
    const out = validateClientRow(
      { rowNumber: 1, values: { firstName: "I", lastName: "K", npi: "12345" } },
      { existingNpis: new Set() },
    );
    expect(out.status).toBe("error");
    expect(out.message).toMatch(/10 digits/);
  });

  it("flags duplicate NPI", () => {
    const out = validateClientRow(
      { rowNumber: 1, values: { firstName: "I", lastName: "K", npi: "1234567890" } },
      { existingNpis: new Set(["1234567890"]) },
    );
    expect(out.status).toBe("duplicate");
  });
});

describe("validateOrganizationRow", () => {
  it("accepts a minimal valid row", () => {
    const out = validateOrganizationRow(
      {
        rowNumber: 1,
        values: { legalName: "Acme Health LLC", displayName: "Acme" },
      },
      { existingLegalNames: new Set() },
    );
    expect(out.status).toBe("valid");
    expect(out.parsed?.legalName).toBe("Acme Health LLC");
  });

  it("rejects too-short names", () => {
    const out = validateOrganizationRow(
      { rowNumber: 1, values: { legalName: "A", displayName: "B" } },
      { existingLegalNames: new Set() },
    );
    expect(out.status).toBe("error");
  });

  it("flags duplicate legal name (case-insensitive)", () => {
    const out = validateOrganizationRow(
      {
        rowNumber: 1,
        values: { legalName: "Acme Health LLC", displayName: "Acme" },
      },
      { existingLegalNames: new Set(["acme health llc"]) },
    );
    expect(out.status).toBe("duplicate");
  });
});
