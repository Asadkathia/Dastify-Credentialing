import { requireAdmin } from "@/lib/auth/session";
import { AppShell, type NavItem } from "@/components/app-shell";
import { NewEnrollmentLauncher } from "@/components/admin/new-enrollment-launcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/organizations", label: "Organizations", icon: "organizations" },
    { href: "/admin/clients", label: "Clients", icon: "clients" },
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
      topbarSlot={
        <NewEnrollmentLauncher
          triggerLabel="New Enrollment"
          triggerSize="sm"
          triggerClassName="hidden h-9 uppercase tracking-[0.12em] md:inline-flex"
        />
      }
    >
      {children}
    </AppShell>
  );
}
