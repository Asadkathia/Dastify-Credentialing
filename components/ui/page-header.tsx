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
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        {icon ? (
          <span
            aria-hidden
            className="mt-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] bg-teal-08 text-teal sm:h-[52px] sm:w-[52px]"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {crumbs && crumbs.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="mb-2 flex flex-wrap items-center gap-1 text-[12px]"
            >
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
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.005em] text-navy break-words sm:text-[24px] sm:leading-8">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-navy/60">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
