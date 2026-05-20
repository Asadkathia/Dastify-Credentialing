import Link from "next/link";
import { Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  status?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

type UserType = "staff" | "org";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  type: UserType;
  roleLabel: string;
  organizationId: string | null;
  organizationName: string | null;
  isActive: boolean;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  org_admin: "Org Admin",
  org_viewer: "Org Viewer",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const typeFilter = (params.type ?? "").trim() as "" | UserType;
  const statusFilter = (params.status ?? "").trim() as "" | "active" | "inactive";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createSupabaseServerClient();

  const activeOnly = statusFilter === "active" ? true : statusFilter === "inactive" ? false : null;

  // Dastify staff. RLS returns all rows to admins (private.is_admin()).
  const rows: UserRow[] = [];
  const errors: string[] = [];

  if (typeFilter !== "org") {
    let adminQuery = supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active, created_at");
    if (q) adminQuery = adminQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    if (activeOnly !== null) adminQuery = adminQuery.eq("is_active", activeOnly);

    const { data, error } = await adminQuery;
    if (error) errors.push(`staff users: ${error.message}`);
    for (const u of data ?? []) {
      rows.push({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        type: "staff",
        roleLabel: roleLabel(u.role),
        organizationId: null,
        organizationName: null,
        isActive: u.is_active,
        createdAt: u.created_at,
      });
    }
  }

  if (typeFilter !== "staff") {
    let orgQuery = supabase
      .from("organization_users")
      .select(
        `id, email, full_name, role, is_active, created_at,
         organization:organization_id (id, display_name)`,
      );
    if (q) orgQuery = orgQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    if (activeOnly !== null) orgQuery = orgQuery.eq("is_active", activeOnly);

    const { data, error } = await orgQuery;
    if (error) errors.push(`org users: ${error.message}`);
    for (const u of data ?? []) {
      const org = Array.isArray(u.organization) ? u.organization[0] : u.organization;
      rows.push({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        type: "org",
        roleLabel: roleLabel(u.role),
        organizationId: org?.id ?? null,
        organizationName: org?.display_name ?? null,
        isActive: u.is_active,
        createdAt: u.created_at,
      });
    }
  }

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const pageRows = rows.slice(from, from + PAGE_SIZE);

  const hasFilters = Boolean(q || typeFilter || statusFilter);
  const error = errors.length > 0 ? errors.join("; ") : null;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={
          <>
            <span className="tnum font-semibold text-charcoal">{total}</span> total — Dastify staff
            and organization users
            {hasFilters ? " (filtered)" : ""}
          </>
        }
      />

      <form
        action="/admin/users"
        method="get"
        className="surface mb-6 flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="h-8 w-[240px] rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        />
        <select
          name="type"
          defaultValue={typeFilter}
          className="h-8 rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        >
          <option value="">All types</option>
          <option value="staff">Dastify Staff</option>
          <option value="org">Org User</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-8 rounded-sm border border-border-subtle bg-white px-2.5 text-[12px] focus-visible:border-teal focus-visible:outline-none"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="h-8 rounded-sm bg-navy px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#161D52]"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/admin/users"
            className="h-8 rounded-sm border border-border-subtle bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/65 transition-colors hover:bg-lightgrey"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger-08 px-4 py-3 text-[13px] text-danger">
          Failed to load users: {error}
        </div>
      ) : pageRows.length === 0 ? (
        <EmptyState
          icon={<Users size={32} strokeWidth={1.4} />}
          title={hasFilters ? "No users match these filters" : "No users yet"}
          description={
            hasFilters
              ? "Try widening the filters, or clear them to see everyone."
              : "Dastify staff and admin-invited organization users appear here once created."
          }
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th className="w-[130px]">Type</th>
                  <th className="w-[120px]">Role</th>
                  <th>Organization</th>
                  <th className="w-[110px]">Status</th>
                  <th className="w-[120px]">Added</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => (
                  <tr key={`${u.type}-${u.id}`}>
                    <td className="font-medium text-navy">{u.fullName}</td>
                    <td className="text-navy/70">{u.email}</td>
                    <td>
                      <Badge variant={u.type === "staff" ? "info" : "secondary"}>
                        {u.type === "staff" ? "Dastify Staff" : "Org User"}
                      </Badge>
                    </td>
                    <td className="text-navy/70">{u.roleLabel}</td>
                    <td>
                      {u.organizationId ? (
                        <Link
                          href={`/admin/organizations/${u.organizationId}`}
                          className="text-navy/85 hover:text-teal"
                        >
                          {u.organizationName}
                        </Link>
                      ) : (
                        <span className="text-navy/45">—</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={u.isActive ? "success" : "outline"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="tnum text-[12px] text-navy/60">
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              from={from + 1}
              to={Math.min(to + 1, total)}
              total={total}
              hrefFor={(p) =>
                `/admin/users?${buildQs({
                  q,
                  type: typeFilter,
                  status: statusFilter,
                  page: String(p),
                })}`
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function buildQs(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, v);
  });
  return sp.toString();
}

function Pagination({
  page,
  totalPages,
  from,
  to,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-[12px] text-navy/65">
      <p className="tnum">
        Showing <span className="font-semibold text-charcoal">{from}</span>–
        <span className="font-semibold text-charcoal">{to}</span> of{" "}
        <span className="font-semibold text-charcoal">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
          >
            ← Prev
          </Link>
        ) : (
          <span className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/30">
            ← Prev
          </span>
        )}
        <span className="tnum px-1">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/75 hover:bg-lightgrey"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-sm border border-border-subtle bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.06em] text-navy/30">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
