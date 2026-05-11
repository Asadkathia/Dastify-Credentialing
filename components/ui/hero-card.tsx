import { cn } from "@/lib/utils";

/**
 * Hero card for detail pages — avatar block, name + meta line, right-aligned
 * mini-stats column, action buttons trailing.
 *
 * Visual treatment matches the design: white surface with a teal top accent
 * stripe and a large square avatar tile.
 */
export function HeroCard({
  avatar,
  avatarTone = "teal",
  title,
  meta,
  stats,
  actions,
  className,
}: {
  /** Two-letter initials shown in the avatar tile. */
  avatar: string;
  avatarTone?: "teal" | "navy" | "amber" | "green";
  /** Main heading — display name / provider name. */
  title: React.ReactNode;
  /** Meta row under the title — legal name, # id, status pill, etc. */
  meta?: React.ReactNode;
  /** Up to ~4 mini-stat cells rendered as a column on the right. */
  stats?: Array<{ label: string; value: React.ReactNode; tone?: "navy" | "amber" | "green" | "teal" }>;
  /** Trailing action buttons. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const avatarBg = {
    teal: "bg-teal-08 text-teal",
    navy: "bg-navy-08 text-navy",
    amber: "bg-warning-08 text-[#7a4f00]",
    green: "bg-success-08 text-[#1B5E20]",
  }[avatarTone];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-md border border-border-subtle bg-white px-5 py-5 shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {/* Teal top accent stripe */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-aqua to-teal/30"
      />

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Avatar + title block */}
        <div className="flex items-center gap-4 min-w-0">
          <span
            aria-hidden
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-md text-[18px] font-bold tracking-[0.04em]",
              avatarBg,
            )}
          >
            {avatar}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.005em] text-navy">
              {title}
            </h1>
            {meta ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-navy/55">
                {meta}
              </div>
            ) : null}
          </div>
        </div>

        {/* Mini-stats column */}
        {stats && stats.length > 0 ? (
          <div className="flex shrink-0 items-center gap-8">
            {stats.map((s, i) => {
              const valueColor = {
                navy: "text-navy",
                amber: "text-[#7a4f00]",
                green: "text-[#1B5E20]",
                teal: "text-teal",
              }[s.tone ?? "navy"];
              return (
                <div key={i} className="text-center md:text-right">
                  <div
                    className={cn(
                      "text-[28px] font-bold leading-none tracking-[-0.01em] tnum",
                      valueColor,
                    )}
                  >
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-navy/45">
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Trailing actions */}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
