"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Client-side sign-out: clears the Supabase session in the browser, then does
 * a hard navigation to /login so middleware re-runs with the cleared cookies.
 *
 * Replaces the previous `<form action={signOutAction}>` pattern, which throws
 * "An unexpected response was received from the server" under Next 15.5.18's
 * Webpack runtime when the server action redirects from inside a form submit.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      // Hard navigation so middleware re-runs against the cleared cookies and
      // routes the user to the public /login surface.
      window.location.href = "/login";
      // Fallback in case `window` isn't there for any reason.
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-md border border-border-subtle px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-navy/65 transition-colors hover:bg-lightgrey hover:text-navy disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
