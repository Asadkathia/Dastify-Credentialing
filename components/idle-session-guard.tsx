"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_IDLE_WARNING_LEAD_MS,
} from "@/lib/auth/session-policy";

/**
 * Watches user input. After 30 minutes with no input it signs the user out and
 * redirects to /login?error=idle. 60 seconds before the cutoff it surfaces a
 * dismissable warning so an active user can stay in their workflow.
 *
 * This is a UX warning — server-side enforcement lives in middleware.ts.
 */
const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

const WARNING_THRESHOLD_MS = SESSION_IDLE_TIMEOUT_MS - SESSION_IDLE_WARNING_LEAD_MS;

export function IdleSessionGuard() {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(SESSION_IDLE_WARNING_LEAD_MS / 1000),
  );
  const lastActivity = useRef(Date.now());
  const signedOut = useRef(false);

  useEffect(() => {
    function onActivity() {
      lastActivity.current = Date.now();
    }

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", onActivity);

    const tick = setInterval(() => {
      if (signedOut.current) return;
      const idleMs = Date.now() - lastActivity.current;

      if (idleMs >= SESSION_IDLE_TIMEOUT_MS) {
        signedOut.current = true;
        const supabase = createSupabaseBrowserClient();
        supabase.auth.signOut().finally(() => {
          window.location.href = "/login?error=idle";
        });
        return;
      }

      if (idleMs >= WARNING_THRESHOLD_MS) {
        setWarning(true);
        setSecondsLeft(
          Math.max(0, Math.ceil((SESSION_IDLE_TIMEOUT_MS - idleMs) / 1000)),
        );
      } else if (warning) {
        setWarning(false);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onActivity);
      clearInterval(tick);
    };
  }, [warning]);

  function stayActive() {
    lastActivity.current = Date.now();
    setWarning(false);
  }

  function signOutNow() {
    if (signedOut.current) return;
    signedOut.current = true;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.signOut().finally(() => {
      window.location.href = "/login";
    });
  }

  return (
    <Dialog
      open={warning}
      onOpenChange={(open) => {
        if (!open) stayActive();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You will be signed out soon</DialogTitle>
          <DialogDescription>
            For your security, your session ends after a period of inactivity. You
            will be signed out in {secondsLeft} second
            {secondsLeft === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={signOutNow}>
            Sign out now
          </Button>
          <Button type="button" onClick={stayActive}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
