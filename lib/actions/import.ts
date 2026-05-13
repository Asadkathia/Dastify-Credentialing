"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { parseXlsx, ImportParseError, type RawRow } from "@/lib/import/parsers";
import {
  validateEnrollmentRow,
  validateClientRow,
  validateOrganizationRow,
  makeEnrollmentKey,
  type ValidateEnrollmentsContext,
} from "@/lib/import/validators";
import type {
  ImportEntityType,
  ImportPreviewRow,
  ImportPreviewSummary,
  ParsedClientRow,
  ParsedEnrollmentRow,
  ParsedOrganizationRow,
} from "@/lib/import/types";

const entitySchema = z.enum(["enrollments", "clients", "organizations"]);

/** Output of previewImport. */
export type ImportPreviewResult<TParsed> = {
  entity: ImportEntityType;
  fileName: string;
  rows: Array<ImportPreviewRow<TParsed>>;
  summary: ImportPreviewSummary;
};

export type ImportCommitResult = {
  entity: ImportEntityType;
  insertedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

// ── previewImport ────────────────────────────────────────────────────────────

export async function previewImportAction(
  formData: FormData,
): Promise<
  ActionResult<
    | ImportPreviewResult<ParsedEnrollmentRow>
    | ImportPreviewResult<ParsedClientRow>
    | ImportPreviewResult<ParsedOrganizationRow>
  >
> {
  await requireAdmin();

  const parsedHeader = parseFormHeader(formData);
  if (!parsedHeader.ok) return fail(parsedHeader.error);
  const { entity, organizationId, clientId, groupEntityId, file } = parsedHeader.data;

  let rawRows: RawRow[];
  try {
    rawRows = await parseXlsx(file, entity);
  } catch (err) {
    if (err instanceof ImportParseError) return fail(err.message);
    return fail(`Parse failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  const supabase = await createSupabaseServerClient();

  if (entity === "enrollments") {
    if (!organizationId) return fail("Pick an organization before uploading.");
    if (!clientId && !groupEntityId) {
      return fail("Pick a client (clinician) or group entity before uploading.");
    }
    if (clientId && groupEntityId) {
      return fail("Pick exactly one subject — a client OR a group entity, not both.");
    }

    const ctx = await loadEnrollmentContext(supabase, organizationId, clientId, groupEntityId);
    const previewRows: Array<ImportPreviewRow<ParsedEnrollmentRow>> = [];
    for (const raw of rawRows) {
      previewRows.push(...validateEnrollmentRow(raw, ctx));
    }
    return ok(buildPreviewResult(entity, file.name, previewRows));
  }

  if (entity === "clients") {
    if (!organizationId) return fail("Pick an organization before uploading.");
    const existingNpis = await loadExistingNpis(supabase, organizationId);
    const previewRows: Array<ImportPreviewRow<ParsedClientRow>> = rawRows.map((r) =>
      validateClientRow(r, { existingNpis }),
    );
    return ok(buildPreviewResult(entity, file.name, previewRows));
  }

  // organizations
  const existingLegalNames = await loadExistingOrgLegalNames(supabase);
  const previewRows: Array<ImportPreviewRow<ParsedOrganizationRow>> = rawRows.map((r) =>
    validateOrganizationRow(r, { existingLegalNames }),
  );
  return ok(buildPreviewResult(entity, file.name, previewRows));
}

// ── commitImport ─────────────────────────────────────────────────────────────

export async function commitImportAction(
  formData: FormData,
): Promise<ActionResult<ImportCommitResult>> {
  const session = await requireAdmin();

  const parsedHeader = parseFormHeader(formData);
  if (!parsedHeader.ok) return fail(parsedHeader.error);
  const { entity, organizationId, clientId, groupEntityId, file } = parsedHeader.data;

  let rawRows: RawRow[];
  try {
    rawRows = await parseXlsx(file, entity);
  } catch (err) {
    if (err instanceof ImportParseError) return fail(err.message);
    return fail(`Parse failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  const supabase = await createSupabaseServerClient();

  if (entity === "enrollments") {
    if (!organizationId) return fail("Pick an organization before uploading.");
    if (!clientId && !groupEntityId) {
      return fail("Pick a client or group entity before uploading.");
    }
    if (clientId && groupEntityId) {
      return fail("Pick exactly one subject.");
    }
    const ctx = await loadEnrollmentContext(supabase, organizationId, clientId, groupEntityId);
    const previewRows = rawRows.flatMap((r) => validateEnrollmentRow(r, ctx));
    const valid = previewRows.filter((r) => r.status === "valid" && r.parsed);
    const insertRows = valid.map((r) => ({
      organization_id: organizationId,
      client_id: clientId ?? null,
      group_entity_id: groupEntityId ?? null,
      payer_id: r.parsed!.payerId,
      state: r.parsed!.state,
      status: r.parsed!.status,
      sub_status: r.parsed!.subStatus,
    }));

    let insertedCount = 0;
    if (insertRows.length > 0) {
      const { data, error } = await supabase
        .from("enrollments")
        .insert(insertRows)
        .select("id");
      if (error) return fail(`Insert failed: ${error.message}`);
      insertedCount = data?.length ?? 0;
    }

    await logImportActivity(
      supabase,
      session.userId,
      organizationId,
      entity,
      file.name,
      insertedCount,
      previewRows.length,
    );

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    return ok(buildCommitResult(entity, insertedCount, previewRows));
  }

  if (entity === "clients") {
    if (!organizationId) return fail("Pick an organization before uploading.");
    const existingNpis = await loadExistingNpis(supabase, organizationId);
    const previewRows = rawRows.map((r) => validateClientRow(r, { existingNpis }));
    const valid = previewRows.filter((r) => r.status === "valid" && r.parsed);
    const insertRows = valid.map((r) => ({
      organization_id: organizationId,
      first_name: r.parsed!.firstName,
      middle_name: r.parsed!.middleName,
      last_name: r.parsed!.lastName,
      suffix: r.parsed!.suffix,
      npi: r.parsed!.npi,
      primary_specialty: r.parsed!.primarySpecialty,
      secondary_specialty: r.parsed!.secondarySpecialty,
      email: r.parsed!.email,
      phone: r.parsed!.phone,
      caqh_id: r.parsed!.caqhId,
    }));

    let insertedCount = 0;
    if (insertRows.length > 0) {
      const { data, error } = await supabase.from("clients").insert(insertRows).select("id");
      if (error) return fail(`Insert failed: ${error.message}`);
      insertedCount = data?.length ?? 0;
    }

    await logImportActivity(
      supabase,
      session.userId,
      organizationId,
      entity,
      file.name,
      insertedCount,
      previewRows.length,
    );

    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath("/admin/clients");
    return ok(buildCommitResult(entity, insertedCount, previewRows));
  }

  // organizations
  const existingLegalNames = await loadExistingOrgLegalNames(supabase);
  const previewRows = rawRows.map((r) => validateOrganizationRow(r, { existingLegalNames }));
  const valid = previewRows.filter((r) => r.status === "valid" && r.parsed);
  const insertRows = valid.map((r) => ({
    legal_name: r.parsed!.legalName,
    display_name: r.parsed!.displayName,
    primary_contact_name: r.parsed!.primaryContactName,
    primary_contact_email: r.parsed!.primaryContactEmail,
    primary_contact_phone: r.parsed!.primaryContactPhone,
    notes: r.parsed!.notes,
  }));

  let insertedIds: string[] = [];
  if (insertRows.length > 0) {
    const { data, error } = await supabase.from("organizations").insert(insertRows).select("id");
    if (error) return fail(`Insert failed: ${error.message}`);
    insertedIds = (data ?? []).map((o) => o.id);
    // Auto-create default settings rows for every new org.
    if (insertedIds.length > 0) {
      await supabase
        .from("organization_settings")
        .insert(insertedIds.map((id) => ({ organization_id: id })));
    }
  }

  await logImportActivity(
    supabase,
    session.userId,
    null,
    entity,
    file.name,
    insertedIds.length,
    previewRows.length,
  );

  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  return ok(buildCommitResult(entity, insertedIds.length, previewRows));
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseFormHeader(formData: FormData):
  | { ok: false; error: string }
  | {
      ok: true;
      data: {
        entity: ImportEntityType;
        organizationId: string | null;
        clientId: string | null;
        groupEntityId: string | null;
        file: File;
      };
    } {
  const entityRaw = formData.get("entity");
  const entityResult = entitySchema.safeParse(entityRaw);
  if (!entityResult.success) return { ok: false, error: "Missing or invalid entity type." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };

  const organizationId = optionalUuid(formData.get("organizationId"));
  const clientId = optionalUuid(formData.get("clientId"));
  const groupEntityId = optionalUuid(formData.get("groupEntityId"));

  return {
    ok: true,
    data: {
      entity: entityResult.data,
      organizationId,
      clientId,
      groupEntityId,
      file,
    },
  };
}

function optionalUuid(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return z.string().uuid().safeParse(t).success ? t : null;
}

async function loadEnrollmentContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  clientId: string | null,
  groupEntityId: string | null,
): Promise<ValidateEnrollmentsContext> {
  const [payersRes, existingRes] = await Promise.all([
    supabase.from("payers").select("id, name"),
    supabase
      .from("enrollments")
      .select("payer_id, state")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq(clientId ? "client_id" : "group_entity_id", clientId ?? groupEntityId!),
  ]);

  const payersByName = new Map<string, { id: string; displayName: string }>();
  for (const p of payersRes.data ?? []) {
    payersByName.set(p.name.trim().toLowerCase(), { id: p.id, displayName: p.name });
  }

  const existingKeys = new Set<string>();
  for (const e of existingRes.data ?? []) {
    existingKeys.add(makeEnrollmentKey(e.payer_id, e.state));
  }

  return { payersByName, existingKeys };
}

async function loadExistingNpis(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("clients")
    .select("npi")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const npis = new Set<string>();
  for (const c of data ?? []) {
    if (c.npi) npis.add(c.npi);
  }
  return npis;
}

async function loadExistingOrgLegalNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("organizations")
    .select("legal_name")
    .is("deleted_at", null);
  const names = new Set<string>();
  for (const o of data ?? []) {
    names.add(o.legal_name.trim().toLowerCase());
  }
  return names;
}

async function logImportActivity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  organizationId: string | null,
  entity: ImportEntityType,
  fileName: string,
  insertedCount: number,
  totalCount: number,
): Promise<void> {
  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    action: "import",
    target_table: entity,
    summary: `Imported ${insertedCount}/${totalCount} ${entity} from ${fileName}`,
    metadata: {
      fileName,
      entity,
      insertedCount,
      totalCount,
    },
  });
}

function buildPreviewResult<TParsed>(
  entity: ImportEntityType,
  fileName: string,
  rows: Array<ImportPreviewRow<TParsed>>,
): ImportPreviewResult<TParsed> {
  return {
    entity,
    fileName,
    rows,
    summary: summarize(rows),
  };
}

function buildCommitResult<TParsed>(
  entity: ImportEntityType,
  insertedCount: number,
  previewRows: Array<ImportPreviewRow<TParsed>>,
): ImportCommitResult {
  const errors = previewRows
    .filter((r) => r.status === "error")
    .map((r) => ({ rowNumber: r.rowNumber, message: r.message ?? "Unknown error" }));
  const skippedCount = previewRows.filter((r) => r.status === "duplicate").length;
  return {
    entity,
    insertedCount,
    skippedCount,
    errorCount: errors.length,
    errors,
  };
}

function summarize<TParsed>(rows: Array<ImportPreviewRow<TParsed>>): ImportPreviewSummary {
  let validRows = 0;
  let errorRows = 0;
  let duplicateRows = 0;
  for (const r of rows) {
    if (r.status === "valid") validRows++;
    else if (r.status === "error") errorRows++;
    else if (r.status === "duplicate") duplicateRows++;
  }
  return { totalRows: rows.length, validRows, errorRows, duplicateRows };
}
