import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  icon,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  /** Optional leading icon — rendered as a 52×52 rounded teal-08 tile to the left of the title block. */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-start justify-between gap-6", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {icon ? (
          <span
            aria-hidden
            className="mt-1 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] bg-teal-08 text-teal"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {crumbs && crumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[12px]">
              {crumbs.map((c, i) => {
                const isLast = i === crumbs.length - 1;
                const node = c.href ? (
                  <Link
                    href={c.href}
                    className="text-navy/55 transition-colors hover:text-navy"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-navy/85 font-medium" : "text-navy/55"}>
                    {c.label}
                  </span>
                );
                return (
                  <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                    {node}
                    {!isLast ? (
                      <ChevronRight size={12} className="text-navy/30" strokeWidth={1.6} />
                    ) : null}
                  </span>
                );
              })}
            </nav>
          ) : null}
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.005em] text-navy">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-[13px] text-navy/60">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
