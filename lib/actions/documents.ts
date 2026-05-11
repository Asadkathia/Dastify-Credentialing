"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  uploadDocumentMetaSchema,
  documentIdSchema,
  createDocumentCategorySchema,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
} from "@/lib/validation/schemas";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

const BUCKET = "documents";

/**
 * Admin-only: upload a file to Supabase Storage and create a documents row.
 *
 * The form sends multipart/form-data with the file as `file` plus metadata
 * fields. We validate metadata server-side, generate a path that encodes
 * client_id (so RLS can use it), upload via the user-scoped Supabase client
 * (which runs RLS — so a non-admin would be denied), then insert the row.
 *
 * Returns the new document id on success.
 */
export async function uploadDocumentAction(
  formData: FormData,
): Promise<ActionResult<{ documentId: string }>> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("No file provided");
  }
  if (file.size === 0) return fail("File is empty");
  if (file.size > MAX_DOCUMENT_BYTES) {
    return fail(`File too large (max ${Math.floor(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB)`);
  }
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return fail(`File type not allowed: ${file.type || "unknown"}`);
  }

  const parsed = uploadDocumentMetaSchema.safeParse({
    clientId: formData.get("clientId"),
    ownerType: formData.get("ownerType"),
    ownerId: formData.get("ownerId"),
    categoryId: formData.get("categoryId"),
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    expirationDate: formData.get("expirationDate") || "",
    isInternal: formData.get("isInternal") === "true",
    description: formData.get("description") || "",
  });
  if (!parsed.success) {
    return fail("Invalid input", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Sanity check: confirm the owner row exists and belongs to the right client
  // (admins see everything via RLS, so this also guards against typos).
  const { data: ownerExists } = await ownerLookup(supabase, parsed.data);
  if (!ownerExists) return fail("Owner record not found for this client");

  // Path: <clientId>/<ownerType>/<ownerId>/<random>-<safeName>
  const safeName = sanitizeFileName(parsed.data.fileName);
  const random = crypto.randomUUID();
  const storagePath = `${parsed.data.clientId}/${parsed.data.ownerType}/${parsed.data.ownerId}/${random}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: parsed.data.mimeType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return fail(`Storage upload failed: ${uploadErr.message}`);
  }

  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      client_id: parsed.data.clientId,
      owner_type: parsed.data.ownerType,
      owner_id: parsed.data.ownerId,
      category_id: parsed.data.categoryId,
      file_name: parsed.data.fileName,
      storage_path: storagePath,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      expiration_date: parsed.data.expirationDate || null,
      is_internal: parsed.data.isInternal,
      virus_scan_status: "pending",
      uploaded_by_user_id: session.userId,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (insertErr || !doc) {
    // Roll back the upload so we don't leak orphan files in storage.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return fail(`Document insert failed: ${insertErr?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    client_id: parsed.data.clientId,
    actor_user_id: session.userId,
    action: "document_upload",
    target_table: "documents",
    target_id: doc.id,
    summary: `Uploaded ${parsed.data.fileName}${parsed.data.isInternal ? " (internal)" : ""}`,
  });

  revalidatePathsForOwner(parsed.data.clientId, parsed.data.ownerType, parsed.data.ownerId);
  return ok({ documentId: doc.id });
}

/**
 * Returns a short-lived signed URL for downloading a document. Permission is
 * enforced by the storage RLS policy: clients can only get URLs for documents
 * that match their client_id and aren't internal.
 */
export async function getDocumentDownloadUrlAction(
  documentId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  await requireSession();
  const parsed = documentIdSchema.safeParse({ documentId });
  if (!parsed.success) return fail("Invalid document id");

  const supabase = await createSupabaseServerClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, storage_path, file_name, is_internal, deleted_at")
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (docErr || !doc) return fail("Document not found");
  if (doc.deleted_at) return fail("Document is deleted");

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60); // 60-second TTL — user clicks immediately
  if (signErr || !signed) return fail(`Could not sign URL: ${signErr?.message ?? "unknown"}`);

  return ok({ url: signed.signedUrl, fileName: doc.file_name });
}

/**
 * Admin-only soft delete: marks the documents row deleted_at and removes the
 * storage object. Audit row is the activity_events insert.
 */
export async function deleteDocumentAction(
  documentId: string,
): Promise<ActionResult<{ documentId: string }>> {
  const session = await requireAdmin();
  const parsed = documentIdSchema.safeParse({ documentId });
  if (!parsed.success) return fail("Invalid document id");

  const supabase = await createSupabaseServerClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, client_id, owner_type, owner_id, storage_path, file_name")
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (docErr || !doc) return fail("Document not found");

  // Remove the storage object first; if that fails, we don't soft-delete (so
  // the user can retry). Admin RLS allows the storage delete.
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  if (rmErr && !rmErr.message.toLowerCase().includes("not found")) {
    return fail(`Storage delete failed: ${rmErr.message}`);
  }

  const { error: updErr } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.documentId);
  if (updErr) return fail(`Soft-delete failed: ${updErr.message}`);

  await supabase.from("activity_events").insert({
    client_id: doc.client_id,
    actor_user_id: session.userId,
    action: "document_delete",
    target_table: "documents",
    target_id: doc.id,
    summary: `Deleted ${doc.file_name}`,
  });

  revalidatePathsForOwner(doc.client_id, doc.owner_type, doc.owner_id);
  return ok({ documentId: doc.id });
}

/**
 * Admin-only: append a new category to the document_categories table.
 * The `name` (machine identifier) is derived from the label by lower-casing
 * and replacing whitespace/punctuation with `_`. If a category with the same
 * name already exists, return that one (idempotent).
 */
export async function createDocumentCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; label: string; isExisting: boolean }>> {
  const session = await requireAdmin();

  const parsed = createDocumentCategorySchema.safeParse(input);
  if (!parsed.success) {
    return fail("Invalid category input", parsed.error.flatten().fieldErrors);
  }

  const machineName = parsed.data.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (!machineName) return fail("Label must contain alphanumeric characters");

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("document_categories")
    .select("id, name, label")
    .eq("name", machineName)
    .maybeSingle();

  if (existing) {
    return ok({ id: existing.id, name: existing.name, label: existing.label, isExisting: true });
  }

  // Place new categories above "Other" but below the last default.
  const { data: highestDefault } = await supabase
    .from("document_categories")
    .select("sort_order")
    .eq("is_default", true)
    .neq("name", "other")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (highestDefault?.sort_order ?? 100) + 10;

  const { data: created, error } = await supabase
    .from("document_categories")
    .insert({
      name: machineName,
      label: parsed.data.label,
      sort_order: sortOrder,
      is_default: false,
      created_by_user_id: session.userId,
    })
    .select("id, name, label")
    .single();

  if (error || !created) {
    return fail(`Failed to add category: ${error?.message ?? "unknown"}`);
  }

  return ok({ id: created.id, name: created.name, label: created.label, isExisting: false });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  // Replace anything outside [A-Za-z0-9._-] with `_`. Collapse runs.
  // Storage keys allow more, but staying narrow avoids surprises.
  return (
    name
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 200) || "file"
  );
}

type SupabaseFromArgs = {
  clientId: string;
  ownerType: "provider" | "enrollment" | "group_entity" | "client";
  ownerId: string;
};

async function ownerLookup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  args: SupabaseFromArgs,
): Promise<{ data: boolean }> {
  const tableByOwner: Record<SupabaseFromArgs["ownerType"], string> = {
    provider: "providers",
    enrollment: "enrollments",
    group_entity: "group_entities",
    client: "clients",
  };
  const table = tableByOwner[args.ownerType];
  const idColumn = args.ownerType === "client" ? "id" : "id";
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(idColumn, args.ownerId)
    .eq(args.ownerType === "client" ? "id" : "client_id", args.clientId);
  return { data: (count ?? 0) > 0 };
}

function revalidatePathsForOwner(clientId: string, ownerType: string, ownerId: string) {
  switch (ownerType) {
    case "enrollment":
      revalidatePath(`/admin/clients/${clientId}/enrollments/${ownerId}`);
      revalidatePath(`/portal/enrollments/${ownerId}`);
      break;
    case "provider":
      revalidatePath(`/admin/clients/${clientId}/providers/${ownerId}`);
      revalidatePath(`/admin/clients/${clientId}`);
      break;
    case "group_entity":
    case "client":
      revalidatePath(`/admin/clients/${clientId}`);
      revalidatePath(`/portal`);
      break;
  }
}
