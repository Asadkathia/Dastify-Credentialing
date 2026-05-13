import { describe, it, expect } from "vitest";
import { normalizeStateCode, splitMultiStateCell } from "@/lib/import/state-mapper";
import { normalizeStatusText } from "@/lib/import/status-mapper";

describe("normalizeStateCode", () => {
  it("returns the canonical 2-letter code for a 2-letter input", () => {
    expect(normalizeStateCode("tx")).toBe("TX");
    expect(normalizeStateCode("TX")).toBe("TX");
    expect(normalizeStateCode(" CA ")).toBe("CA");
  });

  it("returns the 2-letter code for a full state name", () => {
    expect(normalizeStateCode("Texas")).toBe("TX");
    expect(normalizeStateCode("new york")).toBe("NY");
    expect(normalizeStateCode("NEW MEXICO")).toBe("NM");
    expect(normalizeStateCode("District of Columbia")).toBe("DC");
    expect(normalizeStateCode("Puerto Rico")).toBe("PR");
  });

  it("returns null for unknown input", () => {
    expect(normalizeStateCode("")).toBeNull();
    expect(normalizeStateCode(null)).toBeNull();
    expect(normalizeStateCode(undefined)).toBeNull();
    expect(normalizeStateCode("XX")).toBeNull();
    expect(normalizeStateCode("Atlantis")).toBeNull();
  });

  it("rejects 2-letter strings that aren't real codes", () => {
    expect(normalizeStateCode("ZZ")).toBeNull();
    expect(normalizeStateCode("ab")).toBeNull();
  });
});

describe("splitMultiStateCell", () => {
  it("returns empty array for empty input", () => {
    expect(splitMultiStateCell("")).toEqual([]);
    expect(splitMultiStateCell(null)).toEqual([]);
    expect(splitMultiStateCell("   ")).toEqual([]);
  });

  it("returns one item for a single state", () => {
    expect(splitMultiStateCell("TX")).toEqual(["TX"]);
    expect(splitMultiStateCell("Texas")).toEqual(["Texas"]);
  });

  it("splits on commas, semicolons, slashes, and newlines", () => {
    expect(splitMultiStateCell("TX, NM, CA")).toEqual(["TX", "NM", "CA"]);
    expect(splitMultiStateCell("TX; NM; CA")).toEqual(["TX", "NM", "CA"]);
    expect(splitMultiStateCell("TX / NM / CA")).toEqual(["TX", "NM", "CA"]);
    expect(splitMultiStateCell("TX\nNM\nCA")).toEqual(["TX", "NM", "CA"]);
  });

  it("collapses runs of delimiters and trims parts", () => {
    expect(splitMultiStateCell("TX,, NM,,CA")).toEqual(["TX", "NM", "CA"]);
    expect(splitMultiStateCell("  TX  ,  NM  ")).toEqual(["TX", "NM"]);
  });
});

describe("normalizeStatusText", () => {
  it("accepts exact enum values case-insensitively", () => {
    expect(normalizeStatusText("prep")).toBe("prep");
    expect(normalizeStatusText("PREP")).toBe("prep");
    expect(normalizeStatusText("In Review")).toBe("in_review");
    expect(normalizeStatusText("non_par_credentialed")).toBe("non_par_credentialed");
  });

  it("maps legacy synonyms for approved", () => {
    expect(normalizeStatusText("Approved")).toBe("approved");
    expect(normalizeStatusText("Effective")).toBe("approved");
    expect(normalizeStatusText("Active")).toBe("approved");
    expect(normalizeStatusText("In-Network")).toBe("approved");
    expect(normalizeStatusText("Participating")).toBe("approved");
  });

  it("maps legacy synonyms for non_par_credentialed", () => {
    expect(normalizeStatusText("Non-Par")).toBe("non_par_credentialed");
    expect(normalizeStatusText("Non Par Credentialed")).toBe("non_par_credentialed");
    expect(normalizeStatusText("OON")).toBe("non_par_credentialed");
    expect(normalizeStatusText("Out of Network")).toBe("non_par_credentialed");
  });

  it("returns null for unrecognized status text", () => {
    expect(normalizeStatusText("")).toBeNull();
    expect(normalizeStatusText(null)).toBeNull();
    expect(normalizeStatusText("witchcraft")).toBeNull();
    expect(normalizeStatusText("completed")).toBeNull(); // dropped status
    expect(normalizeStatusText("denied")).toBeNull(); // dropped status
  });
});
