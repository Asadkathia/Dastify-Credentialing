"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  fullName,
  email,
  secondaryLabel,
  profileHref,
}: {
  fullName: string;
  email: string;
  secondaryLabel: string;
  profileHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initials = getInitials(fullName);

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-lightgrey focus-visible:ring-2 focus-visible:ring-teal/30 sm:px-2"
        aria-label="Account menu"
      >
        <span
          aria-hidden
          className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-teal text-[11px] font-semibold text-navy"
        >
          {initials}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[12px] font-medium text-navy">{fullName}</span>
          <span className="block text-[9px] uppercase tracking-[0.2em] text-navy/50">
            {secondaryLabel}
          </span>
        </span>
        <ChevronDown size={12} className="hidden text-navy/40 sm:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[15rem]">
        <DropdownMenuLabel>
          <span className="block text-[13px] font-semibold text-navy">{fullName}</span>
          <span className="block truncate text-[11px] text-navy/55">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserCircle2 size={15} strokeWidth={1.7} className="text-navy/55" />
            Profile &amp; settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={pending}
          className="text-danger focus:bg-danger-08 focus:text-danger"
        >
          <LogOut size={15} strokeWidth={1.7} />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
