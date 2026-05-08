import { describe, it, expect } from "vitest";
import { validateTransition } from "@/lib/enrollment/state-machine";

describe("enrollment state machine", () => {
  it("allows the canonical forward path", () => {
    expect(validateTransition("intake", "prep").ok).toBe(true);
    expect(validateTransition("prep", "submitted").ok).toBe(true);
    expect(validateTransition("submitted", "in_review").ok).toBe(true);
    expect(validateTransition("in_review", "approved").ok).toBe(true);
    expect(validateTransition("approved", "effective").ok).toBe(true);
  });

  it("rejects skipping submitted", () => {
    const result = validateTransition("intake", "effective");
    expect(result.ok).toBe(false);
  });

  it("rejects no-op transitions", () => {
    const result = validateTransition("submitted", "submitted");
    expect(result.ok).toBe(false);
  });

  it("allows backwards transitions for corrections", () => {
    expect(validateTransition("in_review", "submitted").ok).toBe(true);
    expect(validateTransition("denied", "in_review").ok).toBe(true);
  });

  it("only allows closed → intake to re-open", () => {
    expect(validateTransition("closed", "intake").ok).toBe(true);
    expect(validateTransition("closed", "submitted").ok).toBe(false);
  });

  it("blocks invalid post-effective transitions except closed", () => {
    expect(validateTransition("effective", "closed").ok).toBe(true);
    expect(validateTransition("effective", "intake").ok).toBe(false);
    expect(validateTransition("effective", "submitted").ok).toBe(false);
  });

  it("allows withdrawn from any active state", () => {
    expect(validateTransition("intake", "withdrawn").ok).toBe(true);
    expect(validateTransition("submitted", "withdrawn").ok).toBe(true);
    expect(validateTransition("in_review", "withdrawn").ok).toBe(true);
  });
});
