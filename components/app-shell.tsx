import Link from "next/link";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { AppSidebarNav, type NavItem } from "@/components/app-sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";

export type { NavItem } from "@/components/app-sidebar-nav";

export function AppShell({
  variant,
  user,
  nav,
  workspaceLabel,
  breadcrumb,
  children,
}: {
  variant: "admin" | "organization";
  user: { fullName: string; email: string; organizationName?: string };
  nav: NavItem[];
  workspaceLabel?: string;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}) {
  const homeHref = variant === "admin" ? "/admin" : "/portal";
  const initials = getInitials(user.fullName);
  const roleLabel = variant === "admin" ? "Dastify · Admin" : "Organization · Viewer";

  return (
    <div className="min-h-screen lg:flex">
      {/* ── Sidebar (navy, fixed full-height on lg+) ───────────────────── */}
      <aside className="hidden w-[220px] shrink-0 flex-col self-stretch bg-navy text-white lg:flex">
        {/* Brand block */}
        <Link
          href={homeHref}
          className="flex items-center gap-3 px-5 pt-[18px] pb-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dastify-logo.svg"
            alt="Dastify"
            className="h-[36px] w-auto select-none"
            draggable={false}
          />
          <span className="flex flex-col leading-tight">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-white">
              Dastify
            </span>
            <span className="text-[8px] font-normal uppercase tracking-[0.25em] text-white/35">
              {variant === "admin" ? "Credentialing" : "Portal"}
            </span>
          </span>
        </Link>

        {/* Section label */}
        <p className="px-5 pt-4 pb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20">
          {workspaceLabel ?? (variant === "organization" ? "Logged in as" : "Workspace")}
        </p>
        {variant === "organization" && user.organizationName ? (
          <p className="px-5 pb-3 text-[13px] font-bold text-white">
            {user.organizationName}
          </p>
        ) : null}

        <AppSidebarNav items={nav} />

        <div className="mt-auto px-3 pb-4">
          <div className="mx-2 mb-3 h-px bg-white/8" />
          <Link
            href="#"
            aria-disabled
            className="flex items-center gap-3 rounded-md px-3 py-[9px] text-[13px] font-medium text-white/35"
          >
            <SettingsLockIcon />
            <span className="flex-1">Settings</span>
          </Link>
        </div>
      </aside>

      {/* ── Right column: topbar + main ──────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar (white, sticky) */}
        <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b border-border-subtle bg-white px-6">
          <div className="flex items-center gap-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-navy/55">
              {variant === "admin" ? "Credentialing" : "Portal"}
            </span>
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
            {variant === "admin" ? (
              <button
                type="button"
                className="hidden h-9 min-w-[300px] items-center gap-2 rounded-md bg-lightgrey px-3 text-[12px] text-navy/55 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-teal/30 hover:bg-grey/30 md:flex"
              >
                <Search size={14} strokeWidth={1.6} className="text-navy/45" />
                <span>Search organizations, clients, payers…</span>
                <kbd className="ml-auto rounded bg-white px-[5px] py-px font-mono text-[10px] text-navy/45 shadow-[var(--shadow-xs)]">
                  ⌘K
                </kbd>
              </button>
            ) : null}

            <button
              type="button"
              aria-label="Help"
              className="flex h-9 w-9 items-center justify-center rounded-md text-navy/55 transition-colors hover:bg-lightgrey hover:text-navy"
            >
              <HelpCircle size={16} strokeWidth={1.6} />
            </button>

            <div className="flex items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-lightgrey">
              <span
                aria-hidden
                className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-teal text-[11px] font-semibold text-navy"
              >
                {initials}
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="text-[12px] font-medium text-navy">{user.fullName}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-navy/50">
                  {variant === "admin" ? roleLabel : (user.organizationName ?? "Organization")}
                </div>
              </div>
              <ChevronDown size={12} className="text-navy/40" />
            </div>

            <SignOutButton />
          </div>
        </header>

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
