import { requireAdmin } from "@/lib/auth/session";
import { AppShell, type NavItem } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/organizations", label: "Clients", icon: "clients" },
    { href: "/admin/clients", label: "Providers", icon: "providers" },
    { href: "/admin/enrollments", label: "Enrollments", icon: "enrollments" },
    { href: "/admin/payers", label: "Payers", icon: "payers" },
    { href: "/admin/audit", label: "Audit Log", icon: "audit" },
  ];

  return (
    <AppShell
      variant="admin"
      user={{ fullName: session.fullName, email: session.email }}
      nav={nav}
      workspaceLabel="Workspace"
    >
      {children}
    </AppShell>
  );
}
