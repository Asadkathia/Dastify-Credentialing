import { requireOrganization } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrganization();
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const baseNav: NavItem[] = [
    { href: "/portal", label: "Dashboard", icon: "dashboard" },
    { href: "/portal/clients", label: "Providers", icon: "providers" },
    { href: "/portal/enrollments", label: "Enrollments", icon: "enrollments" },
  ];

  const navItems: NavItem[] =
    session.role === "org_admin"
      ? [...baseNav, { href: "/portal/team", label: "Team", icon: "team" }]
      : baseNav;

  return (
    <AppShell
      variant="client"
      user={{
        fullName: session.fullName,
        email: session.email,
        clientName: client?.display_name ?? "",
      }}
      nav={navItems}
    >
      {children}
    </AppShell>
  );
}
