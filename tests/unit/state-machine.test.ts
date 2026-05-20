import { describe, it, expect } from "vitest";
import { validateTransition } from "@/lib/enrollment/state-machine";
import { ENROLLMENT_STATUSES } from "@/db/schema/enums";

describe("enrollment state machine", () => {
  it("allows the canonical forward path", () => {
    expect(validateTransition("prep", "submitted").ok).toBe(true);
    expect(validateTransition("submitted", "in_review").ok).toBe(true);
    expect(validateTransition("in_review", "approved").ok).toBe(true);
  });

  it("allows skipping stages (any forward jump)", () => {
    expect(validateTransition("prep", "in_review").ok).toBe(true);
    expect(validateTransition("prep", "approved").ok).toBe(true);
    expect(validateTransition("submitted", "approved").ok).toBe(true);
  });

  it("allows backwards transitions for corrections", () => {
    expect(validateTransition("submitted", "prep").ok).toBe(true);
    expect(validateTransition("in_review", "submitted").ok).toBe(true);
    expect(validateTransition("approved", "in_review").ok).toBe(true);
    expect(validateTransition("approved", "prep").ok).toBe(true);
  });

  it("allows reaching and leaving non_par_credentialed from anywhere", () => {
    expect(validateTransition("prep", "non_par_credentialed").ok).toBe(true);
    expect(validateTransition("submitted", "non_par_credentialed").ok).toBe(true);
    expect(validateTransition("non_par_credentialed", "prep").ok).toBe(true);
    expect(validateTransition("non_par_credentialed", "approved").ok).toBe(true);
  });

  it("rejects only no-op transitions", () => {
    for (const status of ENROLLMENT_STATUSES) {
      expect(validateTransition(status, status).ok).toBe(false);
    }
  });

  it("allows every distinct status pair", () => {
    for (const from of ENROLLMENT_STATUSES) {
      for (const to of ENROLLMENT_STATUSES) {
        if (from === to) continue;
        expect(validateTransition(from, to).ok).toBe(true);
      }
    }
  });
});
