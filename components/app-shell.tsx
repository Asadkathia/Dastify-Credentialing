import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string };

export function AppShell({
  variant,
  user,
  nav,
  children,
}: {
  variant: "admin" | "client";
  user: { fullName: string; email: string; clientName?: string };
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const accent = variant === "admin" ? "Admin" : "Client";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href={variant === "admin" ? "/admin" : "/portal"} className="font-semibold">
              Dastify <span className="text-muted-foreground">·</span>{" "}
              <span className="text-muted-foreground">{accent}</span>
            </Link>
            <nav className="flex items-center gap-4">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user.fullName}</p>
              <p className="text-xs text-muted-foreground leading-tight">
                {user.clientName ?? user.email}
              </p>
            </div>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
