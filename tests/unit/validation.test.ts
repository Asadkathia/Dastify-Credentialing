import { describe, it, expect } from "vitest";
import {
  createOrganizationSchema,
  createClientSchema,
  createEnrollmentSchema,
  transitionStatusSchema,
} from "@/lib/validation/schemas";

describe("validation schemas", () => {
  describe("createOrganizationSchema (discriminated by kind)", () => {
    it("accepts a minimal valid group organization", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "group",
        legalName: "Acme Health LLC",
        displayName: "Acme",
      });
      expect(r.success).toBe(true);
    });

    it("rejects too-short names on a group org", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "group",
        legalName: "A",
        displayName: "A",
      });
      expect(r.success).toBe(false);
    });

    it("rejects a group org missing legalName", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "group",
        displayName: "Acme",
      });
      expect(r.success).toBe(false);
    });

    it("accepts an individual org with minimal clinician fields", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "individual",
        legalName: "Imran Khan MD PLLC",
        displayName: "Dr. Khan",
        firstName: "Imran",
        lastName: "Khan",
      });
      expect(r.success).toBe(true);
    });

    it("rejects an individual org missing firstName", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "individual",
        legalName: "Imran Khan MD PLLC",
        displayName: "Dr. Khan",
        lastName: "Khan",
      });
      expect(r.success).toBe(false);
    });

    it("rejects an individual org with an invalid NPI", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "individual",
        legalName: "Imran Khan MD PLLC",
        displayName: "Dr. Khan",
        firstName: "Imran",
        lastName: "Khan",
        npi: "12345",
      });
      expect(r.success).toBe(false);
    });

    it("accepts an individual org with a valid 10-digit NPI", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "individual",
        legalName: "Imran Khan MD PLLC",
        displayName: "Dr. Khan",
        firstName: "Imran",
        lastName: "Khan",
        npi: "1234567890",
      });
      expect(r.success).toBe(true);
    });

    it("rejects when the kind discriminator is missing", () => {
      const r = createOrganizationSchema.safeParse({
        legalName: "Acme Health LLC",
        displayName: "Acme",
      });
      expect(r.success).toBe(false);
    });

    it("rejects an unknown kind value", () => {
      const r = createOrganizationSchema.safeParse({
        kind: "syndicate",
        legalName: "Acme Health LLC",
        displayName: "Acme",
      });
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

    it("accepts a client (clinician) enrollment with an explicit clientId", () => {
      const r = createEnrollmentSchema.safeParse({
        ...base,
        clientId: "00000000-0000-0000-0000-000000000003",
      });
      expect(r.success).toBe(true);
    });

    it("accepts a payload without clientId (server resolves for individual orgs)", () => {
      // The server action resolves the clientId from the org's singleton for
      // kind='individual'; for kind='group' the server action requires it
      // explicitly and errors otherwise. The schema itself only enforces
      // shape, so a missing clientId is a valid parse.
      const r = createEnrollmentSchema.safeParse(base);
      expect(r.success).toBe(true);
    });

    it("does not produce a groupEntityId field on the inferred type", () => {
      // The discriminated subject is gone; group_entities + the XOR are
      // removed. A successful parse should not surface groupEntityId on the
      // parsed shape.
      const r = createEnrollmentSchema.safeParse({
        ...base,
        clientId: "00000000-0000-0000-0000-000000000003",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect("groupEntityId" in (r.data as Record<string, unknown>)).toBe(false);
      }
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
