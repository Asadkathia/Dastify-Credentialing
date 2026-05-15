import { requireOrganization } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/app-shell";
import { IdleSessionGuard } from "@/components/idle-session-guard";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrganization();
  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", session.organizationId)
    .maybeSingle();

  const baseNav: NavItem[] = [
    { href: "/portal", label: "Dashboard", icon: "dashboard" },
    { href: "/portal/clients", label: "Clients", icon: "clients" },
    { href: "/portal/enrollments", label: "Enrollments", icon: "enrollments" },
  ];

  const navItems: NavItem[] =
    session.role === "org_admin"
      ? [...baseNav, { href: "/portal/team", label: "Team", icon: "team" }]
      : baseNav;

  return (
    <AppShell
      variant="organization"
      user={{
        fullName: session.fullName,
        email: session.email,
        organizationName: org?.display_name ?? "",
      }}
      nav={navItems}
    >
      <IdleSessionGuard />
      {children}
    </AppShell>
  );
}
