"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Upload,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";

const ICON_MAP = {
  dashboard: LayoutDashboard,
  organizations: Building2,
  clients: UserCircle2,
  enrollments: ClipboardList,
  import: Upload,
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
    <nav className="flex flex-col gap-[2px] px-3" aria-label="Primary">
      {items.map((item) => {
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
              text-[13px] font-medium text-white/50 transition-colors
              hover:bg-white/5 hover:text-white/85
              data-[active=true]:bg-teal/14 data-[active=true]:text-teal
            "
          >
            {Icon ? (
              <Icon
                size={17}
                strokeWidth={1.7}
                className="shrink-0 text-current group-data-[active=true]:text-teal"
              />
            ) : null}
            <span className="flex-1">{item.label}</span>
            {item.badge != null ? (
              <span className="ml-auto rounded-full bg-warning/20 px-[7px] py-px text-[10px] font-semibold text-warning tnum">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
