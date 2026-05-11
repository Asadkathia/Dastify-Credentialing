// Inline SVG chart primitives for the dashboard. No external dependency.
// Each chart is a server component — pure presentational, accepts pre-bucketed
// data, paints navy/teal/aqua per CLAUDE.md §3 chart rules.

const NAVY = "#0E143C";
const TEAL = "#16C1C2";
const AQUA = "#4ECED1";
const GREY = "#C6CCD8";
const LIGHTGREY = "#F6F7FB";

/** Tiny single-series line, used inside KPI cards. */
export function Sparkline({
  data,
  color = TEAL,
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const dx = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = i * dx;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
      <circle
        cx={(data.length - 1) * dx}
        cy={height - ((data[data.length - 1]! - min) / span) * (height - 4) - 2}
        r={2}
        fill={color}
      />
    </svg>
  );
}

/** Multi-series line chart with X-axis labels. */
export function LineChart({
  labels,
  series,
  height = 200,
}: {
  labels: string[];
  series: Array<{ color: string; data: number[]; name: string }>;
  height?: number;
}) {
  const width = 600;
  const padTop = 8;
  const padBottom = 28;
  const padLeft = 28;
  const padRight = 12;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allValues);
  const dx = labels.length > 1 ? innerW / (labels.length - 1) : 0;

  // 4 horizontal gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padTop + (1 - t) * innerH;
    return { y, value: Math.round(t * max) };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      aria-label="Throughput trend"
    >
      {/* Gridlines */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={padLeft}
          x2={width - padRight}
          y1={t.y}
          y2={t.y}
          stroke={GREY}
          strokeOpacity="0.3"
          strokeDasharray="2 4"
          strokeWidth="1"
        />
      ))}
      {/* Y-axis tick labels */}
      {yTicks.map((t, i) => (
        <text
          key={`yt-${i}`}
          x={padLeft - 6}
          y={t.y + 3}
          textAnchor="end"
          fontSize="9"
          fill={NAVY}
          fillOpacity="0.5"
          fontFamily="Poppins,sans-serif"
        >
          {t.value}
        </text>
      ))}
      {/* X-axis labels — every Nth to avoid crowding */}
      {labels.map((label, i) => {
        const skip = Math.ceil(labels.length / 8);
        if (i % skip !== 0 && i !== labels.length - 1) return null;
        const x = padLeft + i * dx;
        return (
          <text
            key={`xl-${i}`}
            x={x}
            y={height - 10}
            textAnchor="middle"
            fontSize="9"
            fill={NAVY}
            fillOpacity="0.55"
            fontFamily="Poppins,sans-serif"
          >
            {label}
          </text>
        );
      })}
      {/* Series lines */}
      {series.map((s, si) => {
        const points = s.data.map((v, i) => {
          const x = padLeft + i * dx;
          const y = padTop + (1 - v / max) * innerH;
          return `${x},${y}`;
        });
        return (
          <g key={si}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.join(" ")}
            />
            {/* End-point dot */}
            <circle
              cx={padLeft + (s.data.length - 1) * dx}
              cy={padTop + (1 - s.data[s.data.length - 1]! / max) * innerH}
              r="3"
              fill={s.color}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Vertical bar chart for a single series. */
export function BarChart({
  data,
  height = 180,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}) {
  if (data.length === 0) return null;
  const width = 600;
  const padTop = 8;
  const padBottom = 28;
  const padLeft = 28;
  const padRight = 12;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slotW = innerW / data.length;
  const barW = slotW * 0.6;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden>
      {/* Gridlines */}
      {[0, 0.5, 1].map((t, i) => {
        const y = padTop + (1 - t) * innerH;
        return (
          <line
            key={i}
            x1={padLeft}
            x2={width - padRight}
            y1={y}
            y2={y}
            stroke={GREY}
            strokeOpacity="0.3"
            strokeDasharray="2 4"
            strokeWidth="1"
          />
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = padLeft + i * slotW + (slotW - barW) / 2;
        const y = padTop + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="2"
              fill={d.color ?? TEAL}
            />
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill={NAVY}
              fontFamily="Poppins,sans-serif"
            >
              {d.value}
            </text>
            <text
              x={x + barW / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="9"
              fill={NAVY}
              fillOpacity="0.55"
              fontFamily="Poppins,sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut chart for status distribution. */
export function Donut({
  data,
  total,
  totalLabel = "Total",
  size = 200,
}: {
  data: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
  totalLabel?: string;
  size?: number;
}) {
  const r = size / 2;
  const innerR = r * 0.7;
  const sum = data.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -Math.PI / 2; // start at 12 o'clock

  // Build arc paths
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const portion = d.value / sum;
      const start = angle;
      const end = angle + portion * Math.PI * 2;
      angle = end;
      const path = arcPath(r, r, r, innerR, start, end);
      return { ...d, path };
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Status distribution"
    >
      <circle cx={r} cy={r} r={r} fill={LIGHTGREY} />
      {arcs.map((a, i) => (
        <path key={i} d={a.path} fill={a.color} />
      ))}
      <circle cx={r} cy={r} r={innerR} fill="white" />
      <text
        x={r}
        y={r - 4}
        textAnchor="middle"
        fontSize="24"
        fontWeight="700"
        fill={NAVY}
        fontFamily="Poppins,sans-serif"
      >
        {total}
      </text>
      <text
        x={r}
        y={r + 14}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill={NAVY}
        fillOpacity="0.5"
        letterSpacing="0.12em"
        fontFamily="Poppins,sans-serif"
      >
        {totalLabel.toUpperCase()}
      </text>
    </svg>
  );
}

/** Horizontal bar list — for denial rate by payer, etc. */
export function HorizontalBarList({
  data,
  formatValue,
  trackFill = LIGHTGREY,
  barFill = TEAL,
}: {
  data: Array<{ label: string; value: number; max?: number; suffix?: string }>;
  formatValue?: (v: number) => string;
  trackFill?: string;
  barFill?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.max ?? d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <li key={i} className="grid grid-cols-[96px_1fr] items-center gap-3">
            <span className="truncate text-[12px] font-medium text-charcoal" title={d.label}>
              {d.label}
            </span>
            <div className="flex items-center gap-2.5">
              <div
                className="relative h-[14px] flex-1 rounded-[2px] overflow-hidden"
                style={{ background: trackFill }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-[2px]"
                  style={{ width: `${pct}%`, background: barFill }}
                />
              </div>
              <span className="min-w-[60px] text-right tnum text-[11px] font-semibold text-navy">
                {formatValue ? formatValue(d.value) : d.value}
                {d.suffix ? <span className="ml-1 text-navy/55 font-normal">{d.suffix}</span> : null}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// SVG arc path helper for donut slices.
function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

export const CHART_COLORS = {
  navy: NAVY,
  teal: TEAL,
  aqua: AQUA,
  grey: GREY,
  amber: "#F4A300",
  red: "#B3261E",
  green: "#2E7D32",
};
