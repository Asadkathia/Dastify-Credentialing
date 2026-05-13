import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { buildImportTemplateXlsx } from "@/lib/import/templates";
import type { ImportEntityType } from "@/lib/import/types";

const VALID_ENTITIES: ReadonlySet<ImportEntityType> = new Set([
  "enrollments",
  "clients",
  "organizations",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> },
): Promise<Response> {
  // Admin-only: same gate as the import flow itself.
  try {
    await requireAdmin();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { entity } = await params;
  if (!VALID_ENTITIES.has(entity as ImportEntityType)) {
    return new NextResponse("Unknown template", { status: 404 });
  }

  const bytes = await buildImportTemplateXlsx(entity as ImportEntityType);
  const filename = `dastify-import-${entity}.xlsx`;
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
