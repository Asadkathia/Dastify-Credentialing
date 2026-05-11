import { describe, it, expect } from "vitest";
import { validateTransition } from "@/lib/enrollment/state-machine";

describe("enrollment state machine", () => {
  it("allows the canonical forward path", () => {
    expect(validateTransition("prep", "submitted").ok).toBe(true);
    expect(validateTransition("submitted", "in_review").ok).toBe(true);
    expect(validateTransition("in_review", "approved").ok).toBe(true);
    expect(validateTransition("approved", "completed").ok).toBe(true);
  });

  it("rejects skipping submitted", () => {
    const result = validateTransition("prep", "completed");
    expect(result.ok).toBe(false);
  });

  it("rejects no-op transitions", () => {
    const result = validateTransition("submitted", "submitted");
    expect(result.ok).toBe(false);
  });

  it("allows backwards transitions for corrections", () => {
    expect(validateTransition("submitted", "prep").ok).toBe(true);
    expect(validateTransition("in_review", "submitted").ok).toBe(true);
    expect(validateTransition("approved", "in_review").ok).toBe(true);
  });

  it("non_par_credentialed is reachable from in_review and approved", () => {
    expect(validateTransition("in_review", "non_par_credentialed").ok).toBe(true);
    expect(validateTransition("approved", "non_par_credentialed").ok).toBe(true);
    expect(validateTransition("prep", "non_par_credentialed").ok).toBe(false);
    expect(validateTransition("submitted", "non_par_credentialed").ok).toBe(false);
  });

  it("terminal states only re-open via prior active states", () => {
    // completed → approved (re-open to correct an error)
    expect(validateTransition("completed", "approved").ok).toBe(true);
    expect(validateTransition("completed", "prep").ok).toBe(false);
    expect(validateTransition("completed", "submitted").ok).toBe(false);

    // non_par_credentialed → in_review | approved
    expect(validateTransition("non_par_credentialed", "in_review").ok).toBe(true);
    expect(validateTransition("non_par_credentialed", "approved").ok).toBe(true);
    expect(validateTransition("non_par_credentialed", "prep").ok).toBe(false);
  });
});
