"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Settings,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  clients: Building2,
  providers: UserCircle2,
  enrollments: ClipboardList,
  recreds: RefreshCw,
  payers: Wallet,
  documents: FileText,
  audit: Activity,
  team: Users,
  settings: Settings,
} as const;

export type NavIcon = keyof typeof ICON_MAP;

export type NavItem = {
  href: string;
  label: string;
  icon?: NavIcon;
  badge?: number | string;
};

export function AppSidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-px px-3" aria-label="Primary">
      {items.map((item) => {
        // Root routes (/admin, /portal) require exact match so they don't stay
        // active on every nested route. Other items match on prefix.
        const isRoot = item.href === "/admin" || item.href === "/portal";
        const isActive = isRoot ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon ? ICON_MAP[item.icon] : null;

        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            className="
              group relative flex items-center gap-3 rounded-md px-3 py-[9px]
              text-[13px] font-medium text-navy/70 transition-colors
              hover:bg-navy-04 hover:text-navy
              data-[active=true]:bg-teal-08 data-[active=true]:font-semibold data-[active=true]:text-navy
            "
          >
            {/* Active rail */}
            <span
              aria-hidden
              className="absolute -left-3 top-1.5 bottom-1.5 w-[2px] rounded-r bg-teal opacity-0 transition-opacity group-data-[active=true]:opacity-100"
            />
            {Icon ? (
              <Icon
                size={16}
                strokeWidth={1.6}
                className="shrink-0 text-current group-data-[active=true]:text-teal"
              />
            ) : null}
            <span className="flex-1">{item.label}</span>
            {item.badge != null ? (
              <span className="ml-auto rounded-full bg-warning-08 px-[7px] py-px text-[10px] font-semibold text-[hsl(var(--warning))] tnum">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
