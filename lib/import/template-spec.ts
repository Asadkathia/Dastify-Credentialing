import type { ImportEntityType } from "./types";

/**
 * Spec used both to generate the downloadable xlsx template (see
 * `lib/import/templates.ts`) and to render the in-page preview (see
 * `app/admin/import/_components/template-preview.tsx`).
 *
 * Keeping this file free of `server-only` imports so client components can
 * read the spec directly.
 */
export type TemplateColumn = {
  /** Header text written to the xlsx and shown in the preview table. */
  header: string;
  /** True if the parser flags an error when this column is blank. */
  required: boolean;
  /** Sample cell value (also written into row 3 of the downloadable file). */
  example: string;
  /** Plain-language description shown under the preview table. */
  description: string;
  /** Suggested column width in the xlsx (Excel character units). */
  width: number;
};

export type TemplateSpec = {
  /** Yellow banner row at the top of the xlsx and above the preview table. */
  banner: string;
  columns: TemplateColumn[];
};

export const TEMPLATE_SPECS: Record<ImportEntityType, TemplateSpec> = {
  enrollments: {
    banner:
      "Bulk-import enrollments for one Client (clinician) or Group entity under one Organization. Multi-state cells (e.g. `TX, NM`) expand into one enrollment row per state. Status accepts the 5 enum values plus common aliases.",
    columns: [
      {
        header: "States",
        required: true,
        example: "TX, NM",
        description:
          "Two-letter US codes or full names. Multiple states per cell are allowed — separate with commas, semicolons, slashes, or newlines. Each state becomes its own enrollment row.",
        width: 14,
      },
      {
        header: "Payers",
        required: true,
        example: "Aetna",
        description:
          "Payer name as it appears in the Payers master list (case-insensitive). Add unknown payers under Payers before importing — the importer does NOT auto-create payers.",
        width: 28,
      },
      {
        header: "Participation Request Status",
        required: true,
        example: "Submitted",
        description:
          "One of: Prep, Submitted, In Review, Approved, Non-Par Credentialed. Common aliases are accepted (Effective / Active / In-Network → Approved; Non-Par / OON / Out-of-Network → Non-Par Credentialed).",
        width: 30,
      },
      {
        header: "Comments",
        required: false,
        example: "CAQH attestation pending",
        description:
          "Free-form text. Stored as `sub_status` on the enrollment — surfaced on the detail screen and in the export.",
        width: 48,
      },
    ],
  },
  clients: {
    banner:
      "Bulk-import individual clinicians under one Organization (the org is picked in the upload form, not in the file). First + Last Name are required. NPI must be 10 digits when present.",
    columns: [
      {
        header: "First Name",
        required: true,
        example: "Imran",
        description: "Given name. Required.",
        width: 14,
      },
      {
        header: "Middle Name",
        required: false,
        example: "",
        description: "Optional. Displayed as a single-letter initial in lists.",
        width: 12,
      },
      {
        header: "Last Name",
        required: true,
        example: "Khan",
        description: "Family / surname. Required.",
        width: 14,
      },
      {
        header: "Suffix",
        required: false,
        example: "MD",
        description: "Credential suffix (MD, DO, NP, PA-C, etc.). Optional.",
        width: 8,
      },
      {
        header: "NPI",
        required: false,
        example: "1234567890",
        description:
          "10-digit National Provider Identifier. Optional but recommended — used for duplicate detection within the organization.",
        width: 14,
      },
      {
        header: "Primary Specialty",
        required: false,
        example: "Internal Medicine",
        description: "Free-form text.",
        width: 22,
      },
      {
        header: "Secondary Specialty",
        required: false,
        example: "Endocrinology",
        description: "Free-form text.",
        width: 22,
      },
      {
        header: "Email",
        required: false,
        example: "ikhan@example.com",
        description: "Must be a valid email address when present.",
        width: 24,
      },
      {
        header: "Phone",
        required: false,
        example: "+1 512 555 0100",
        description: "Free-form; no canonical format enforced.",
        width: 18,
      },
      {
        header: "CAQH ID",
        required: false,
        example: "12345678",
        description: "Free-form CAQH identifier. Optional.",
        width: 14,
      },
    ],
  },
  organizations: {
    banner:
      "Bulk-import organizations (tenant practices Dastify provides credentialing services to). Legal + Display Name are required, both ≥ 2 characters. Duplicates are detected by Legal Name (case-insensitive).",
    columns: [
      {
        header: "Legal Name",
        required: true,
        example: "Acme Health Practice LLC",
        description:
          "Full legal entity name. Used as the duplicate-detection key. Required.",
        width: 28,
      },
      {
        header: "Display Name",
        required: true,
        example: "Acme Health",
        description: "Short name shown across the UI. Required.",
        width: 22,
      },
      {
        header: "Primary Contact Name",
        required: false,
        example: "Jane Doe",
        description: "Optional point of contact.",
        width: 22,
      },
      {
        header: "Primary Contact Email",
        required: false,
        example: "jane@acme.example",
        description: "Must be a valid email when present.",
        width: 26,
      },
      {
        header: "Primary Contact Phone",
        required: false,
        example: "+1 512 555 0100",
        description: "Free-form. Optional.",
        width: 18,
      },
      {
        header: "Notes",
        required: false,
        example: "Onboarded 2026-05-14",
        description: "Free-form notes stored on the organization record.",
        width: 30,
      },
    ],
  },
};
