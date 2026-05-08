import { requireClient } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClient();
  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("display_name")
    .eq("id", session.clientId)
    .maybeSingle();

  const navItems =
    session.role === "client_admin"
      ? [
          { href: "/portal", label: "Dashboard" },
          { href: "/portal/team", label: "Team" },
        ]
      : [{ href: "/portal", label: "Dashboard" }];

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
