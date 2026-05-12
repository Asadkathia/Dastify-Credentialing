import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClient();
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("display_name")
    .eq("id", session.clientId)
    .maybeSingle();

  const baseNav: NavItem[] = [
    { href: "/portal", label: "Dashboard", icon: "dashboard" },
    { href: "/portal/providers", label: "Providers", icon: "providers" },
    { href: "/portal/enrollments", label: "Enrollments", icon: "enrollments" },
  ];

  const navItems: NavItem[] =
    session.role === "client_admin"
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
