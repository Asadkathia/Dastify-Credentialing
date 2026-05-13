import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath", () => {
  it("accepts a simple same-origin path", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/portal/enrollments?status=approved")).toBe(
      "/portal/enrollments?status=approved",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("//evil.example/path")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("http://evil.example/x")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("rejects backslash tricks normalized by browsers", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/admin\\..\\evil")).toBe("/");
  });

  it("rejects control characters and header-splitting payloads", () => {
    expect(safeNextPath("/admin\r\nLocation: https://evil")).toBe("/");
    expect(safeNextPath("/admin\x00")).toBe("/");
  });

  it("rejects non-string and empty inputs", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(42)).toBe("/");
  });

  it("respects a custom fallback", () => {
    expect(safeNextPath(undefined, "/admin")).toBe("/admin");
    expect(safeNextPath("https://evil.example", "/portal")).toBe("/portal");
  });
});
