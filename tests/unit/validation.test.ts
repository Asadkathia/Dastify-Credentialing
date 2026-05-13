import { describe, it, expect } from "vitest";
import {
  createOrganizationSchema,
  createClientSchema,
  createEnrollmentSchema,
  transitionStatusSchema,
} from "@/lib/validation/schemas";

describe("validation schemas", () => {
  describe("createOrganizationSchema", () => {
    it("accepts a minimal valid organization", () => {
      const r = createOrganizationSchema.safeParse({
        legalName: "Acme Health LLC",
        displayName: "Acme",
      });
      expect(r.success).toBe(true);
    });

    it("rejects too-short names", () => {
      const r = createOrganizationSchema.safeParse({ legalName: "A", displayName: "A" });
      expect(r.success).toBe(false);
    });
  });

  describe("createClientSchema (individual clinician)", () => {
    const base = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      firstName: "Imran",
      lastName: "Khan",
    };

    it("accepts a minimal valid client", () => {
      const r = createClientSchema.safeParse(base);
      expect(r.success).toBe(true);
    });

    it("rejects missing firstName", () => {
      const r = createClientSchema.safeParse({ ...base, firstName: "" });
      expect(r.success).toBe(false);
    });

    it("rejects a non-10-digit NPI", () => {
      const r = createClientSchema.safeParse({ ...base, npi: "12345" });
      expect(r.success).toBe(false);
    });
  });

  describe("createEnrollmentSchema", () => {
    const base = {
      organizationId: "00000000-0000-0000-0000-000000000001",
      payerId: "00000000-0000-0000-0000-000000000002",
      state: "TX",
    };

    it("accepts a client (clinician) enrollment", () => {
      const r = createEnrollmentSchema.safeParse({
        ...base,
        clientId: "00000000-0000-0000-0000-000000000003",
      });
      expect(r.success).toBe(true);
    });

    it("accepts a group enrollment", () => {
      const r = createEnrollmentSchema.safeParse({
        ...base,
        groupEntityId: "00000000-0000-0000-0000-000000000004",
      });
      expect(r.success).toBe(true);
    });

    it("rejects neither client nor group", () => {
      const r = createEnrollmentSchema.safeParse(base);
      expect(r.success).toBe(false);
    });

    it("rejects both client and group", () => {
      const r = createEnrollmentSchema.safeParse({
        ...base,
        clientId: "00000000-0000-0000-0000-000000000003",
        groupEntityId: "00000000-0000-0000-0000-000000000004",
      });
      expect(r.success).toBe(false);
    });

    it("rejects malformed state codes", () => {
      const r = createEnrollmentSchema.safeParse({
        ...base,
        clientId: "00000000-0000-0000-0000-000000000003",
        state: "tx",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("transitionStatusSchema", () => {
    it("accepts a valid enum value", () => {
      const r = transitionStatusSchema.safeParse({
        enrollmentId: "00000000-0000-0000-0000-000000000001",
        toStatus: "submitted",
      });
      expect(r.success).toBe(true);
    });

    it("rejects an invented status", () => {
      const r = transitionStatusSchema.safeParse({
        enrollmentId: "00000000-0000-0000-0000-000000000001",
        toStatus: "wibble",
      });
      expect(r.success).toBe(false);
    });
  });
});
