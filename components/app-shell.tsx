import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { AppSidebarNav, type NavItem } from "@/components/app-sidebar-nav";

export type { NavItem } from "@/components/app-sidebar-nav";

export function AppShell({
  variant,
  user,
  nav,
  workspaceLabel,
  breadcrumb,
  children,
}: {
  variant: "admin" | "client";
  user: { fullName: string; email: string; clientName?: string };
  nav: NavItem[];
  /** Sidebar section header — e.g. "Workspace" for admin, client display name for portal. */
  workspaceLabel?: string;
  /** Optional breadcrumb rendered in the top bar (visible on >=md). */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}) {
  const homeHref = variant === "admin" ? "/admin" : "/portal";
  const initials = getInitials(user.fullName);
  const roleLabel = variant === "admin" ? "Dastify · Admin" : "Client · Admin";

  return (
    <div className="min-h-screen">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/5 bg-navy px-6 text-white">
        <div className="flex items-center gap-7">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <Image
              src="/dastify-mark.png"
              alt=""
              aria-hidden
              width={28}
              height={28}
              priority
              className="h-7 w-7"
            />
            <span className="text-[15px] font-semibold leading-none">Dastify</span>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Credentialing
            </span>
          </Link>
          {breadcrumb ? (
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-1.5 text-[13px] md:flex"
            >
              {breadcrumb}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {/* Search affordance — visual only for now; Cmd+K is not wired in v1. */}
          <button
            type="button"
            className="hidden h-9 min-w-[300px] items-center gap-2 rounded-md border border-white/10 bg-white/8 px-[10px] text-[12px] text-white/65 transition-colors hover:bg-white/12 hover:text-white md:flex"
          >
            <Search size={14} strokeWidth={1.6} />
            <span>Search clients, providers, payers…</span>
            <kbd className="ml-auto rounded bg-white/10 px-[5px] py-px font-mono text-[10px] text-white/70">
              ⌘K
            </kbd>
          </button>

          {/* User pill */}
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1 transition-colors hover:bg-white/6">
            <span
              aria-hidden
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-teal text-[11px] font-semibold text-navy"
            >
              {initials}
            </span>
            <div className="hidden leading-tight sm:block">
              <div className="text-[12px] font-medium text-white">{user.fullName}</div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-white/55">
                {variant === "admin" ? roleLabel : (user.clientName ?? "Client")}
              </div>
            </div>
            <ChevronDown size={12} className="text-white/50" />
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/75 transition-colors hover:bg-white/8 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Body: sidebar + main ───────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border-subtle bg-white py-6 lg:flex">
          <div className="px-6">
            <p className="label-sm pb-3">{workspaceLabel ?? "Workspace"}</p>
          </div>
          <AppSidebarNav items={nav} />
          <div className="mx-6 my-4 h-px bg-border-subtle" />
          <div className="px-3">
            <Link
              href="#"
              aria-disabled
              className="flex items-center gap-3 rounded-md px-3 py-[9px] text-[13px] font-medium text-navy/40"
            >
              {/* Settings — placeholder until §A17 ships */}
              <SettingsLockIcon />
              <span className="flex-1">Settings</span>
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-8 pt-8 pb-16">{children}</main>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function SettingsLockIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.39.16.74.4 1.02.7" />
    </svg>
  );
}
