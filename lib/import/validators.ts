import "server-only";
import { normalizeStateCode, splitMultiStateCell } from "./state-mapper";
import { normalizeStatusText } from "./status-mapper";
import type { RawRow } from "./parsers";
import type {
  ImportPreviewRow,
  ParsedClientRow,
  ParsedEnrollmentRow,
  ParsedOrganizationRow,
} from "./types";

const NPI_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Enrollments ──────────────────────────────────────────────────────────────

export type ValidateEnrollmentsContext = {
  /** Map: lowercased trimmed payer name → payer.id */
  payersByName: Map<string, { id: string; displayName: string }>;
  /** Set of unique-key tuples that already exist for this (org, subject). */
  existingKeys: Set<string>;
};

/**
 * Returns one preview row per state in the multi-state cell.
 * (A single source-file row with `TX, NM` expands into two preview rows.)
 */
export function validateEnrollmentRow(
  raw: RawRow,
  ctx: ValidateEnrollmentsContext,
): Array<ImportPreviewRow<ParsedEnrollmentRow>> {
  const states = splitMultiStateCell(raw.values.states ?? "");
  const payerInput = (raw.values.payers ?? "").trim();
  const statusInput = (raw.values.status ?? "").trim();
  const comments = (raw.values.comments ?? "").trim();

  if (states.length === 0) {
    return [
      previewError(raw, raw.values, "Missing or empty State."),
    ];
  }
  if (!payerInput) {
    return [
      previewError(raw, raw.values, "Missing Payer name."),
    ];
  }
  if (!statusInput) {
    return [
      previewError(raw, raw.values, "Missing Status."),
    ];
  }

  const payerKey = payerInput.toLowerCase();
  const payerHit = ctx.payersByName.get(payerKey);
  if (!payerHit) {
    return [
      previewError(
        raw,
        raw.values,
        `Unknown payer "${payerInput}". Add it under Payers first, or correct the spelling.`,
      ),
    ];
  }

  const status = normalizeStatusText(statusInput);
  if (!status) {
    return [
      previewError(
        raw,
        raw.values,
        `Unrecognized status "${statusInput}". Valid examples: Prep, Submitted, In Review, Approved, Non-Par Credentialed.`,
      ),
    ];
  }

  // One preview row per state.
  const out: Array<ImportPreviewRow<ParsedEnrollmentRow>> = [];
  for (let i = 0; i < states.length; i++) {
    const rawState = states[i]!;
    const stateCode = normalizeStateCode(rawState);
    const perStateRaw = { ...raw.values, states: rawState };
    const rowNumber = states.length > 1 ? raw.rowNumber + i * 0.1 : raw.rowNumber;

    if (!stateCode) {
      out.push(previewError({ ...raw, rowNumber }, perStateRaw, `Unknown state "${rawState}".`));
      continue;
    }

    // Duplicate check is per-state.
    if (
      ctx.existingKeys.has(makeEnrollmentKey(payerHit.id, stateCode))
    ) {
      out.push({
        rowNumber,
        status: "duplicate",
        raw: perStateRaw,
        parsed: null,
        message: `Enrollment for ${payerHit.displayName} · ${stateCode} already exists for this subject.`,
      });
      continue;
    }

    // Also dedupe within the same import file (two rows for the same payer+state).
    const inFileKey = makeEnrollmentKey(payerHit.id, stateCode);
    ctx.existingKeys.add(inFileKey);

    out.push({
      rowNumber,
      status: "valid",
      raw: perStateRaw,
      parsed: {
        state: stateCode,
        payerId: payerHit.id,
        payerName: payerHit.displayName,
        status,
        subStatus: comments.length > 0 ? comments : null,
      },
      message: null,
    });
  }

  return out;
}

/** Key for dedup: (payerId, stateCode). Subject + org are implicit in context. */
export function makeEnrollmentKey(payerId: string, stateCode: string): string {
  return `${payerId}::${stateCode}`;
}

// ── Clients (clinicians) ─────────────────────────────────────────────────────

export type ValidateClientsContext = {
  /** Set of NPIs that already exist in this org. */
  existingNpis: Set<string>;
};

export function validateClientRow(
  raw: RawRow,
  ctx: ValidateClientsContext,
): ImportPreviewRow<ParsedClientRow> {
  const firstName = (raw.values.firstName ?? "").trim();
  const lastName = (raw.values.lastName ?? "").trim();
  if (!firstName) return previewError(raw, raw.values, "Missing First Name.");
  if (!lastName) return previewError(raw, raw.values, "Missing Last Name.");

  const npi = (raw.values.npi ?? "").trim();
  if (npi.length > 0 && !NPI_REGEX.test(npi)) {
    return previewError(raw, raw.values, `NPI must be 10 digits ("${npi}").`);
  }

  const email = (raw.values.email ?? "").trim();
  if (email.length > 0 && !EMAIL_REGEX.test(email)) {
    return previewError(raw, raw.values, `Invalid email "${email}".`);
  }

  if (npi.length > 0 && ctx.existingNpis.has(npi)) {
    return {
      rowNumber: raw.rowNumber,
      status: "duplicate",
      raw: raw.values,
      parsed: null,
      message: `A client with NPI ${npi} already exists in this organization.`,
    };
  }

  if (npi.length > 0) ctx.existingNpis.add(npi);

  return {
    rowNumber: raw.rowNumber,
    status: "valid",
    raw: raw.values,
    parsed: {
      firstName,
      middleName: nullable(raw.values.middleName),
      lastName,
      suffix: nullable(raw.values.suffix),
      npi: nullable(npi),
      primarySpecialty: nullable(raw.values.primarySpecialty),
      secondarySpecialty: nullable(raw.values.secondarySpecialty),
      email: nullable(email),
      phone: nullable(raw.values.phone),
      caqhId: nullable(raw.values.caqhId),
    },
    message: null,
  };
}

// ── Organizations ────────────────────────────────────────────────────────────

export type ValidateOrganizationsContext = {
  /** Lowercased trimmed legal_names that already exist. */
  existingLegalNames: Set<string>;
};

export function validateOrganizationRow(
  raw: RawRow,
  ctx: ValidateOrganizationsContext,
): ImportPreviewRow<ParsedOrganizationRow> {
  const legalName = (raw.values.legalName ?? "").trim();
  const displayName = (raw.values.displayName ?? "").trim();
  if (!legalName) return previewError(raw, raw.values, "Missing Legal Name.");
  if (!displayName) return previewError(raw, raw.values, "Missing Display Name.");
  if (legalName.length < 2) return previewError(raw, raw.values, "Legal Name too short.");
  if (displayName.length < 2) return previewError(raw, raw.values, "Display Name too short.");

  const email = (raw.values.primaryContactEmail ?? "").trim();
  if (email.length > 0 && !EMAIL_REGEX.test(email)) {
    return previewError(raw, raw.values, `Invalid contact email "${email}".`);
  }

  const key = legalName.toLowerCase();
  if (ctx.existingLegalNames.has(key)) {
    return {
      rowNumber: raw.rowNumber,
      status: "duplicate",
      raw: raw.values,
      parsed: null,
      message: `An organization with legal name "${legalName}" already exists.`,
    };
  }
  ctx.existingLegalNames.add(key);

  return {
    rowNumber: raw.rowNumber,
    status: "valid",
    raw: raw.values,
    parsed: {
      legalName,
      displayName,
      primaryContactName: nullable(raw.values.primaryContactName),
      primaryContactEmail: nullable(email),
      primaryContactPhone: nullable(raw.values.primaryContactPhone),
      notes: nullable(raw.values.notes),
    },
    message: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nullable(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function previewError<T>(
  raw: RawRow | { rowNumber: number },
  rawValues: Record<string, string>,
  message: string,
): ImportPreviewRow<T> {
  return {
    rowNumber: raw.rowNumber,
    status: "error",
    raw: rawValues,
    parsed: null,
    message,
  };
}
