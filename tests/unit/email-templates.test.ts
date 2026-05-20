import { describe, it, expect } from "vitest";
import {
  statusChangeEmail,
  commentPostedEmail,
  digestEmail,
} from "@/lib/email/templates";
import { DEFAULT_DISCLAIMER } from "@/lib/email/layout";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ENROLLMENT_ID = "22222222-2222-2222-2222-222222222222";

describe("statusChangeEmail", () => {
  const base = {
    clientName: "Northstar Pediatrics",
    providerOrGroupName: "Khan, Imran M.",
    payerName: "Aetna",
    state: "TX",
    organizationId: ORG_ID,
    enrollmentId: ENROLLMENT_ID,
  };

  it("builds a subject with the new status label", () => {
    const { subject } = statusChangeEmail({ ...base, fromStatus: "in_review", toStatus: "approved" });
    expect(subject).toBe("Status update — Khan, Imran M. · Aetna (TX): Approved");
  });

  it("renders the 4-stage pipeline for a linear status and links to the portal", () => {
    const { html } = statusChangeEmail({ ...base, fromStatus: "in_review", toStatus: "approved" });
    for (const label of ["Prep", "Submitted", "In Review", "Approved"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(`/portal/enrollments/${ENROLLMENT_ID}`);
  });

  it("renders a pill (not the pipeline) for the off-rail non_par_credentialed status", () => {
    const { html } = statusChangeEmail({
      ...base,
      fromStatus: "in_review",
      toStatus: "non_par_credentialed",
    });
    expect(html).toContain("Non-par credentialed");
    expect(html).not.toContain("Prep"); // pipeline labels absent
  });

  it("uses the org disclaimer override when provided, default otherwise", () => {
    const custom = statusChangeEmail({ ...base, fromStatus: null, toStatus: "submitted", disclaimer: "Custom note." });
    expect(custom.html).toContain("Custom note.");

    const fallback = statusChangeEmail({ ...base, fromStatus: null, toStatus: "submitted", disclaimer: null });
    expect(fallback.html).toContain(DEFAULT_DISCLAIMER);
  });
});

describe("commentPostedEmail", () => {
  const base = {
    authorName: "Sarah Chen",
    orgName: "Northstar Pediatrics",
    bodyExcerpt: "Submitting to the network this week.",
    providerOrGroupName: "Khan, Imran M.",
    payerName: "Aetna",
    state: "TX",
    organizationId: ORG_ID,
    enrollmentId: ENROLLMENT_ID,
  };

  it("client audience links to the portal, shows the disclaimer, and is not tagged INTERNAL", () => {
    const { html } = commentPostedEmail({ ...base, audience: "client", disclaimer: null });
    expect(html).toContain(`/portal/enrollments/${ENROLLMENT_ID}`);
    expect(html).toContain(DEFAULT_DISCLAIMER);
    expect(html).not.toContain("INTERNAL");
  });

  it("admin audience links to the admin enrollment route, is tagged INTERNAL, and omits the disclaimer", () => {
    const { html } = commentPostedEmail({ ...base, audience: "admin", disclaimer: null });
    expect(html).toContain(`/admin/organizations/${ORG_ID}/enrollments/${ENROLLMENT_ID}`);
    expect(html).toContain("INTERNAL");
    expect(html).not.toContain(DEFAULT_DISCLAIMER);
  });

  it("escapes HTML in the comment body to prevent injection in mail clients", () => {
    const { html } = commentPostedEmail({
      ...base,
      audience: "client",
      bodyExcerpt: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("digestEmail", () => {
  const base = {
    clientName: "Northstar Pediatrics",
    periodLabel: "Weekly",
    periodRange: "May 12 – 19, 2026",
    statusChanges: [{ summary: "Khan, Imran M. · Aetna (TX) → Approved", at: "May 18" }],
    newComments: 5,
  };

  it("builds a subject and renders the stat counts + portal link", () => {
    const { subject, html } = digestEmail(base);
    expect(subject).toBe("Northstar Pediatrics — Weekly credentialing digest");
    expect(html).toContain(">1<"); // status changes count
    expect(html).toContain(">5<"); // new comments count
    expect(html).toContain("/portal");
  });

  it("escapes activity summaries", () => {
    const { html } = digestEmail({
      ...base,
      statusChanges: [{ summary: '<b>oops</b>', at: "May 18" }],
    });
    expect(html).not.toContain("<b>oops</b>");
    expect(html).toContain("&lt;b&gt;oops&lt;/b&gt;");
  });
});
