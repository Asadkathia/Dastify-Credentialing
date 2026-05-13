import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildEnrollmentsXlsx,
  defaultGeneratedHeader,
  type ExportRow,
  type ExportSheet,
} from "@/lib/export/xlsx";
import type { EnrollmentStatus } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

/**
 * Streams an .xlsx of enrollments for the requesting client (or for a given
 * organization_id when an admin calls it with ?organizationId=...). Format reproduces the
 * pre-portal Excel template.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  const supabase = await createSupabaseServerClient();

  const { searchParams } = new URL(request.url);
  let organizationId: string;

  if (session.role === "admin") {
    const requested = searchParams.get("organizationId");
    if (!requested) {
      return NextResponse.json(
        { error: "organizationId query param is required for admin exports" },
        { status: 400 },
      );
    }
    organizationId = requested;
  } else {
    organizationId = session.organizationId;
  }

  // Load banner + enrollments + latest comment per enrollment.
  const [{ data: settings }, { data: client }, { data: enrollments }] = await Promise.all([
    supabase
      .from("organization_settings")
      .select("disclaimer_banner_text")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("organizations").select("display_name").eq("id", organizationId).maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        `id, state, status, sub_status,
         provider:client_id (id, first_name, last_name, npi),
         group_entity:group_entity_id (id, legal_name),
         payer:payer_id (id, name)`,
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("state"),
  ]);

  if (!client || !enrollments) {
    return NextResponse.json({ error: "Client not found or no access" }, { status: 404 });
  }

  // Pull latest comment per enrollment in one query.
  const enrollmentIds = enrollments.map((e) => e.id);
  const latestCommentByEnrollment = new Map<string, string>();
  if (enrollmentIds.length > 0) {
    const { data: comments } = await supabase
      .from("comments")
      .select("enrollment_id, body, created_at")
      .in("enrollment_id", enrollmentIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    for (const c of comments ?? []) {
      if (!latestCommentByEnrollment.has(c.enrollment_id)) {
        latestCommentByEnrollment.set(c.enrollment_id, c.body);
      }
    }
  }

  // Group rows by subject (provider or group entity); one sheet per subject.
  const sheetMap = new Map<string, ExportSheet>();
  for (const e of enrollments) {
    const provider = Array.isArray(e.provider) ? e.provider[0] : e.provider;
    const groupEntity = Array.isArray(e.group_entity) ? e.group_entity[0] : e.group_entity;
    const payer = Array.isArray(e.payer) ? e.payer[0] : e.payer;

    const subjectKey = provider
      ? `provider:${provider.id}`
      : groupEntity
        ? `group:${groupEntity.id}`
        : "unknown";
    const subjectLabel = provider
      ? `Provider: ${provider.first_name} ${provider.last_name}${provider.npi ? ` (NPI ${provider.npi})` : ""}`
      : groupEntity
        ? `Group: ${groupEntity.legal_name}`
        : "Unknown subject";
    const sheetName = (provider
      ? `${provider.last_name}, ${provider.first_name}`
      : (groupEntity?.legal_name ?? "Unknown")
    ).slice(0, 31);

    if (!sheetMap.has(subjectKey)) {
      sheetMap.set(subjectKey, {
        sheetName,
        headerLeft: subjectLabel,
        headerRight: defaultGeneratedHeader(),
        rows: [],
      });
    }
    const row: ExportRow = {
      state: e.state,
      payerName: payer?.name ?? "—",
      status: e.status as EnrollmentStatus,
      subStatus: e.sub_status,
      latestComment: latestCommentByEnrollment.get(e.id) ?? null,
    };
    sheetMap.get(subjectKey)!.rows.push(row);
  }

  if (sheetMap.size === 0) {
    sheetMap.set("empty", {
      sheetName: "Empty",
      headerLeft: `Client: ${client.display_name}`,
      headerRight: defaultGeneratedHeader(),
      rows: [],
    });
  }

  const buffer = await buildEnrollmentsXlsx({
    bannerText:
      settings?.disclaimer_banner_text ??
      "All Insurances take up to 90-120 business days for processing.",
    sheets: Array.from(sheetMap.values()),
  });

  // Log export.
  await supabase.from("activity_events").insert({
    organization_id: organizationId,
    actor_user_id: session.userId,
    action: "export",
    target_table: "enrollments",
    summary: `Exported ${enrollments.length} enrollments to .xlsx`,
  });

  const filename = `dastify-${client.display_name.replace(/[^a-z0-9]/gi, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  // Copy into a fresh ArrayBuffer to satisfy Node 22's strict BodyInit typing
  // (Uint8Array<ArrayBufferLike> is not directly assignable to BlobPart).
  const out = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(out).set(buffer);

  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
