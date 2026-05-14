"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function MobileNavDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open navigation"
        className="flex h-10 w-10 items-center justify-center rounded-md text-navy/70 transition-colors hover:bg-lightgrey hover:text-navy lg:hidden"
      >
        <Menu size={20} strokeWidth={1.6} />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden"
        />
        <DialogPrimitive.Content
          aria-label="Navigation"
          className="fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[80vw] flex-col bg-navy text-white shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Primary navigation for the portal.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="Close navigation"
            className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none"
          >
            <X size={18} strokeWidth={1.6} />
          </DialogPrimitive.Close>
          <div className="flex h-full flex-col overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
