import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import {
  ImportFlow,
  type ClientOption,
  type GroupEntityOption,
  type OrgOption,
} from "./_components/import-flow";
import type { ImportEntityType } from "@/lib/import/types";

type SearchParams = Promise<{ entity?: string }>;

const VALID_ENTITIES: ReadonlySet<ImportEntityType> = new Set([
  "enrollments",
  "clients",
  "organizations",
]);

const TABS: Array<{ id: ImportEntityType; label: string; description: string }> = [
  {
    id: "enrollments",
    label: "Enrollments",
    description:
      "Bulk-add enrollments under one client (clinician) or group entity. Legacy 4-column template (States · Payers · Status · Comments).",
  },
  {
    id: "clients",
    label: "Clients",
    description:
      "Bulk-add individual clinicians under one organization. Each row is one client.",
  },
  {
    id: "organizations",
    label: "Organizations",
    description:
      "Bulk-add tenant practices. Each row is one organization; default settings are created automatically.",
  },
];

export default async function AdminImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const entity: ImportEntityType = VALID_ENTITIES.has(params.entity as ImportEntityType)
    ? (params.entity as ImportEntityType)
    : "enrollments";

  const supabase = await createSupabaseServerClient();
  const [orgsRes, clientsRes, groupsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name")
      .is("deleted_at", null)
      .order("display_name"),
    supabase
      .from("clients")
      .select("id, organization_id, first_name, middle_name, last_name, suffix")
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("group_entities")
      .select("id, organization_id, legal_name")
      .is("deleted_at", null)
      .order("legal_name"),
  ]);

  const organizations: OrgOption[] = (orgsRes.data ?? []).map((o) => ({
    id: o.id,
    displayName: o.display_name,
  }));
  const clients: ClientOption[] = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    organizationId: c.organization_id,
    firstName: c.first_name,
    lastName: c.last_name,
    middleName: c.middle_name,
    suffix: c.suffix,
  }));
  const groupEntities: GroupEntityOption[] = (groupsRes.data ?? []).map((g) => ({
    id: g.id,
    organizationId: g.organization_id,
    legalName: g.legal_name,
  }));

  const activeTab = TABS.find((t) => t.id === entity)!;

  return (
    <div>
      <PageHeader
        title="Import"
        subtitle={
          <>
            Bulk-load enrollments, clients, or organizations from an Excel file. Always parses
            and previews before any rows hit the database — duplicates and errors are skipped.
          </>
        }
      />

      {/* Entity tabs */}
      <div className="mb-4 inline-flex rounded-lg bg-lightgrey p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/import?entity=${t.id}`}
            className={
              "inline-flex items-center rounded-md px-3.5 py-1.5 text-[12px] uppercase tracking-[0.12em] transition-colors " +
              (t.id === entity
                ? "bg-navy font-semibold text-white shadow-[var(--shadow-xs)]"
                : "font-semibold text-navy/55 hover:text-navy")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <p className="mb-6 text-[13px] text-navy/65">{activeTab.description}</p>

      <ImportFlow
        entity={entity}
        organizations={organizations}
        clients={clients}
        groupEntities={groupEntities}
      />
    </div>
  );
}
