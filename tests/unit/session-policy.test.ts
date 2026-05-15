import { describe, expect, it } from "vitest";
import {
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  checkSessionExpiry,
  parseActivityCookie,
  parseLastSignInAt,
} from "@/lib/auth/session-policy";

describe("parseActivityCookie", () => {
  it("returns the timestamp for a valid numeric cookie", () => {
    expect(parseActivityCookie("1700000000000")).toBe(1700000000000);
  });

  it("returns null for missing, empty, or non-numeric input", () => {
    expect(parseActivityCookie(undefined)).toBeNull();
    expect(parseActivityCookie("")).toBeNull();
    expect(parseActivityCookie("not-a-number")).toBeNull();
    expect(parseActivityCookie("NaN")).toBeNull();
  });

  it("rejects non-positive timestamps", () => {
    expect(parseActivityCookie("0")).toBeNull();
    expect(parseActivityCookie("-1")).toBeNull();
  });
});

describe("parseLastSignInAt", () => {
  it("returns the millisecond timestamp for a valid ISO string", () => {
    expect(parseLastSignInAt("2026-05-15T12:00:00.000Z")).toBe(
      Date.UTC(2026, 4, 15, 12, 0, 0),
    );
  });

  it("returns null for missing or unparseable input", () => {
    expect(parseLastSignInAt(undefined)).toBeNull();
    expect(parseLastSignInAt(null)).toBeNull();
    expect(parseLastSignInAt("")).toBeNull();
    expect(parseLastSignInAt("not a date")).toBeNull();
  });
});

describe("checkSessionExpiry", () => {
  const now = 1_700_000_000_000;

  it("returns null inside both windows", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - 60_000,
        lastSignInAt: now - 60 * 60 * 1000,
      }),
    ).toBeNull();
  });

  it("returns 'idle' when activity is older than the idle window", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - SESSION_IDLE_TIMEOUT_MS - 1,
        lastSignInAt: now - 60 * 60 * 1000,
      }),
    ).toBe("idle");
  });

  it("returns 'absolute' when last_sign_in_at is older than the absolute window", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - 60_000,
        lastSignInAt: now - SESSION_ABSOLUTE_TIMEOUT_MS - 1,
      }),
    ).toBe("absolute");
  });

  it("idle takes precedence over absolute when both trip", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - SESSION_IDLE_TIMEOUT_MS - 1,
        lastSignInAt: now - SESSION_ABSOLUTE_TIMEOUT_MS - 1,
      }),
    ).toBe("idle");
  });

  it("does not expire when timestamps are exactly on the boundary", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - SESSION_IDLE_TIMEOUT_MS,
        lastSignInAt: now - SESSION_ABSOLUTE_TIMEOUT_MS,
      }),
    ).toBeNull();
  });

  it("tolerates a null lastActivityAt (first request after login)", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: null,
        lastSignInAt: now - 60 * 60 * 1000,
      }),
    ).toBeNull();
  });

  it("tolerates a null lastSignInAt (claim missing)", () => {
    expect(
      checkSessionExpiry({
        now,
        lastActivityAt: now - 60_000,
        lastSignInAt: null,
      }),
    ).toBeNull();
  });
});
