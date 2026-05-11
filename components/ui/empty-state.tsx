import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  className,
}: {
  /** Icon node — typically a Lucide icon at 48px, teal for default, danger for error. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** "default" for empty states, "error" for failure states. */
  tone?: "default" | "error";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-border-subtle bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-md",
            tone === "error" ? "text-danger" : "text-teal",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-[24px] font-semibold leading-8 tracking-[-0.005em] text-navy">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-[360px] text-[14px] leading-[22px] text-navy/55">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
