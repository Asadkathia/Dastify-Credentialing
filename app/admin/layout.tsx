import { requireAdmin } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <AppShell
      variant="admin"
      user={{ fullName: session.fullName, email: session.email }}
      nav={[
        { href: "/admin", label: "Clients" },
        { href: "/admin/payers", label: "Payers" },
        { href: "/admin/recreds", label: "Upcoming Recreds" },
      ]}
    >
      {children}
    </AppShell>
  );
}
