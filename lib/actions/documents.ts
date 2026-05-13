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

export async function uploadDocumentAction(
  formData: FormData,
): Promise<ActionResult<{ documentId: string }>> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("No file provided");
  if (file.size === 0) return fail("File is empty");
  if (file.size > MAX_DOCUMENT_BYTES) {
    return fail(`File too large (max ${Math.floor(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB)`);
  }
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return fail(`File type not allowed: ${file.type || "unknown"}`);
  }

  const parsed = uploadDocumentMetaSchema.safeParse({
    organizationId: formData.get("organizationId"),
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

  const { data: ownerExists } = await ownerLookup(supabase, parsed.data);
  if (!ownerExists) return fail("Owner record not found for this organization");

  // Path: <organizationId>/<ownerType>/<ownerId>/<random>-<safeName>
  const safeName = sanitizeFileName(parsed.data.fileName);
  const random = crypto.randomUUID();
  const storagePath = `${parsed.data.organizationId}/${parsed.data.ownerType}/${parsed.data.ownerId}/${random}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: parsed.data.mimeType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) return fail(`Storage upload failed: ${uploadErr.message}`);

  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      organization_id: parsed.data.organizationId,
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
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return fail(`Document insert failed: ${insertErr?.message ?? "unknown"}`);
  }

  await supabase.from("activity_events").insert({
    organization_id: parsed.data.organizationId,
    actor_user_id: session.userId,
    action: "document_upload",
    target_table: "documents",
    target_id: doc.id,
    summary: `Uploaded ${parsed.data.fileName}${parsed.data.isInternal ? " (internal)" : ""}`,
  });

  revalidatePathsForOwner(parsed.data.organizationId, parsed.data.ownerType, parsed.data.ownerId);
  return ok({ documentId: doc.id });
}

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
    .createSignedUrl(doc.storage_path, 60);
  if (signErr || !signed) return fail(`Could not sign URL: ${signErr?.message ?? "unknown"}`);

  return ok({ url: signed.signedUrl, fileName: doc.file_name });
}

export async function deleteDocumentAction(
  documentId: string,
): Promise<ActionResult<{ documentId: string }>> {
  const session = await requireAdmin();
  const parsed = documentIdSchema.safeParse({ documentId });
  if (!parsed.success) return fail("Invalid document id");

  const supabase = await createSupabaseServerClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, organization_id, owner_type, owner_id, storage_path, file_name")
    .eq("id", parsed.data.documentId)
    .maybeSingle();
  if (docErr || !doc) return fail("Document not found");

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
    organization_id: doc.organization_id,
    actor_user_id: session.userId,
    action: "document_delete",
    target_table: "documents",
    target_id: doc.id,
    summary: `Deleted ${doc.file_name}`,
  });

  revalidatePathsForOwner(doc.organization_id, doc.owner_type, doc.owner_id);
  return ok({ documentId: doc.id });
}

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

function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 200) || "file"
  );
}

type SupabaseFromArgs = {
  organizationId: string;
  ownerType: "provider" | "enrollment" | "group_entity" | "client";
  ownerId: string;
};

async function ownerLookup(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  args: SupabaseFromArgs,
): Promise<{ data: boolean }> {
  // Note: ownerType "provider" is legacy; new code uses "client" for clinicians.
  // The clients table now holds clinicians (formerly providers).
  const tableByOwner: Record<SupabaseFromArgs["ownerType"], string> = {
    provider: "clients",
    enrollment: "enrollments",
    group_entity: "group_entities",
    client: "organizations",
  };
  const table = tableByOwner[args.ownerType];
  const orgColumn = args.ownerType === "client" ? "id" : "organization_id";
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("id", args.ownerId)
    .eq(orgColumn, args.organizationId);
  return { data: (count ?? 0) > 0 };
}

function revalidatePathsForOwner(organizationId: string, ownerType: string, ownerId: string) {
  switch (ownerType) {
    case "enrollment":
      revalidatePath(`/admin/organizations/${organizationId}/enrollments/${ownerId}`);
      revalidatePath(`/portal/enrollments/${ownerId}`);
      break;
    case "provider":
      revalidatePath(`/admin/organizations/${organizationId}/clients/${ownerId}`);
      revalidatePath(`/admin/organizations/${organizationId}`);
      break;
    case "group_entity":
    case "client":
      revalidatePath(`/admin/organizations/${organizationId}`);
      revalidatePath(`/portal`);
      break;
  }
}
