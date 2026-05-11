/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio */
const { useState, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewMode": "admin",
  "range": "90d"
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────
const adminData = {
  kpis: {
    active:    { value: 1247, delta: +84,   deltaLabel: "vs. 90d ago", spark: [1102,1118,1131,1142,1158,1166,1179,1188,1201,1218,1233,1247], color: "navy" },
    recreds:   { value: 89,   delta: +12,   deltaLabel: "vs. 90d ago", spark: [62,68,71,73,75,79,81,83,84,86,88,89], color: "amber" },
    info_req:  { value: 34,   delta: -5,    deltaLabel: "vs. 30d ago", spark: [44,42,40,39,41,38,37,36,35,35,34,34], color: "amber" },
    tte:       { value: 47,   delta: -3,    deltaLabel: "vs. prior period", spark: [54,52,52,50,51,49,49,48,48,48,47,47], color: "teal", suffix: "d" },
  },
  throughput: {
    weeks: ["W6","W7","W8","W9","W10","W11","W12","W13","W14","W15","W16","W17","W18"],
    submitted: [42,38,45,51,47,52,49,55,48,53,58,51,57],
    effective: [28,32,30,35,38,36,41,39,44,42,47,45,49],
  },
  status: [
    { key: "intake",         count: 84  },
    { key: "prep",           count: 156 },
    { key: "submitted",      count: 198 },
    { key: "in_review",      count: 287 },
    { key: "info_requested", count: 34  },
    { key: "approved",       count: 142 },
    { key: "denied",         count: 38  },
    { key: "effective",      count: 218 },
    { key: "closed",         count: 64  },
    { key: "withdrawn",      count: 26  },
  ],
  recredForecast: [
    { month: "Jun", prep: 14, not_started: 8 },
    { month: "Jul", prep: 19, not_started: 12 },
    { month: "Aug", prep: 22, not_started: 16 },
    { month: "Sep", prep: 18, not_started: 11 },
    { month: "Oct", prep: 16, not_started: 14 },
    { month: "Nov", prep: 12, not_started: 8 },
  ],
  denialRate: [
    { payer: "Aetna",     rate: 12.4, denom: 242 },
    { payer: "BCBS — TX", rate: 9.8,  denom: 184 },
    { payer: "UHC",       rate: 8.6,  denom: 315 },
    { payer: "Cigna",     rate: 7.2,  denom: 167 },
    { payer: "Humana",    rate: 6.4,  denom: 143 },
    { payer: "Anthem",    rate: 5.9,  denom: 228 },
    { payer: "BCBS — CA", rate: 4.8,  denom: 104 },
    { payer: "Molina",    rate: 4.1,  denom: 89  },
    { payer: "Centene",   rate: 3.6,  denom: 122 },
    { payer: "Kaiser",    rate: 2.8,  denom: 76  },
  ],
  recentlyUpdated: [
    { provider: "Dr. Imran Khan",      payer: "Aetna",     state: "TX", status: "in_review",      updated: "2h ago" },
    { provider: "Dr. Sarah Chen",      payer: "BCBS — TX", state: "TX", status: "approved",       updated: "4h ago" },
    { provider: "Dr. Marcus Patel",    payer: "UHC",       state: "CA", status: "info_requested", updated: "6h ago" },
    { provider: "Dr. Lina Rodriguez",  payer: "Humana",    state: "FL", status: "submitted",      updated: "8h ago" },
    { provider: "Dr. James Okonkwo",   payer: "Cigna",     state: "NY", status: "prep",           updated: "12h ago" },
    { provider: "Dr. Priya Suri",      payer: "Anthem",    state: "CA", status: "effective",      updated: "1d ago" },
    { provider: "Dr. Daniel Park",     payer: "Aetna",     state: "NY", status: "in_review",      updated: "1d ago" },
    { provider: "Dr. Olivia Reyes",    payer: "BCBS — CA", state: "CA", status: "approved",       updated: "2d ago" },
  ],
  stuck: [
    { provider: "Dr. Robert Lee",      payer: "UHC",       state: "NY", days: 18, actor: "M. Alvarez" },
    { provider: "Dr. Aisha Taylor",    payer: "Cigna",     state: "TX", days: 14, actor: "S. Park" },
    { provider: "Dr. Marcus Patel",    payer: "UHC",       state: "CA", days: 12, actor: "M. Alvarez" },
    { provider: "Dr. Erin Wallace",    payer: "Humana",    state: "FL", days: 11, actor: "S. Park" },
    { provider: "Dr. Hugo Mendez",     payer: "Aetna",     state: "TX", days: 9,  actor: "M. Alvarez" },
    { provider: "Dr. Yara Nasser",     payer: "Anthem",    state: "CA", days: 8,  actor: "S. Park" },
    { provider: "Dr. Tomás Soto",      payer: "BCBS — TX", state: "TX", days: 7,  actor: "M. Alvarez" },
    { provider: "Dr. Naima Brooks",    payer: "UHC",       state: "NY", days: 7,  actor: "S. Park" },
  ],
};

const clientData = {
  // Khan Internal Medicine — RLS-scoped slice
  kpis: {
    active:    { value: 14, delta: +2,  deltaLabel: "vs. 90d ago", spark: [10,10,11,11,12,12,12,13,13,13,14,14], color: "navy" },
    recreds:   { value: 4,  delta: +1,  deltaLabel: "vs. 90d ago", spark: [2,2,3,3,3,3,3,4,4,4,4,4], color: "amber" },
    info_req:  { value: 2,  delta: -1,  deltaLabel: "vs. 30d ago", spark: [4,3,3,3,2,2,2,2,2,2,2,2], color: "amber" },
    comments:  { value: 7,  delta: +3,  deltaLabel: "this week", spark: [2,3,3,4,5,5,6,6,6,7,7,7], color: "teal" },
  },
  throughput: {
    weeks: ["W6","W7","W8","W9","W10","W11","W12","W13","W14","W15","W16","W17","W18"],
    submitted: [1,0,1,2,1,1,2,1,0,2,1,1,2],
    effective: [0,1,0,1,1,0,1,1,1,2,1,1,1],
  },
  status: [
    { key: "intake",         count: 1 },
    { key: "prep",           count: 2 },
    { key: "submitted",      count: 3 },
    { key: "in_review",      count: 3 },
    { key: "info_requested", count: 2 },
    { key: "approved",       count: 1 },
    { key: "denied",         count: 0 },
    { key: "effective",      count: 2 },
    { key: "closed",         count: 0 },
    { key: "withdrawn",      count: 0 },
  ],
  recredForecast: [
    { month: "Jun", prep: 1, not_started: 0 },
    { month: "Jul", prep: 1, not_started: 1 },
    { month: "Aug", prep: 0, not_started: 2 },
    { month: "Sep", prep: 0, not_started: 0 },
    { month: "Oct", prep: 0, not_started: 1 },
    { month: "Nov", prep: 0, not_started: 0 },
  ],
  recentlyUpdated: [
    { provider: "Dr. Imran Khan",  payer: "Aetna",     state: "TX", status: "in_review",      updated: "2h ago" },
    { provider: "Dr. Imran Khan",  payer: "BCBS — TX", state: "TX", status: "approved",       updated: "1d ago" },
    { provider: "Dr. Imran Khan",  payer: "UHC",       state: "TX", status: "info_requested", updated: "2d ago" },
    { provider: "Dr. Sana Khan",   payer: "Aetna",     state: "TX", status: "prep",           updated: "3d ago" },
    { provider: "Dr. Sana Khan",   payer: "BCBS — TX", state: "TX", status: "submitted",      updated: "4d ago" },
    { provider: "Dr. Imran Khan",  payer: "Cigna",     state: "TX", status: "effective",      updated: "6d ago" },
    { provider: "Dr. Sana Khan",   payer: "Humana",    state: "TX", status: "intake",         updated: "8d ago" },
    { provider: "Dr. Imran Khan",  payer: "Humana",    state: "TX", status: "in_review",      updated: "12d ago" },
  ],
  recentComments: [
    { provider: "Dr. Imran Khan", payer: "Aetna · TX",     author: "Maya Alvarez",   excerpt: "Aetna confirmed the file is complete and queued for the May 14 committee review. We expect a determination within 10–14 business days…", at: "3d ago" },
    { provider: "Dr. Imran Khan", payer: "UHC · TX",       author: "Sam Park",       excerpt: "UHC requested an updated malpractice COI showing the higher tier limits. I've drafted a request to the carrier — should land Friday…",       at: "4d ago" },
    { provider: "Dr. Sana Khan",  payer: "BCBS — TX · TX", author: "Maya Alvarez",   excerpt: "Submission confirmed. BCBS-TX shows a 35–45 day review window for this product line, so expect status movement around mid-June.",            at: "6d ago" },
    { provider: "Dr. Imran Khan", payer: "Cigna · TX",     author: "Sam Park",       excerpt: "Effective date set to 2026-04-01. Welcome packet from Cigna will arrive by mail in the next 7–10 days.",                                       at: "11d ago" },
    { provider: "Dr. Sana Khan",  payer: "Aetna · TX",     author: "Maya Alvarez",   excerpt: "Prep work begun for Cycle 1 with Aetna. CAQH attestation has been refreshed; license verification pending.",                                  at: "13d ago" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Status colors (chip) and chart color mapping
// ─────────────────────────────────────────────────────────────────────────────
const statusStyles = {
  intake:         { bg: "var(--lightgrey)", text: "var(--charcoal)",     dot: "var(--grey)",    chart: "#C6CCD8" },
  prep:           { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--aqua)",    chart: "#4ECED1" },
  submitted:      { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--teal)",    chart: "#16C1C2" },
  in_review:      { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--teal)",    chart: "#0E143C" },
  info_requested: { bg: "var(--amber-08)",  text: "var(--charcoal)",     dot: "var(--amber)",   chart: "#F4A300" },
  approved:       { bg: "var(--green-08)",  text: "#1B5E20",             dot: "var(--green)",   chart: "#2E7D32" },
  denied:         { bg: "var(--red-08)",    text: "var(--red)",          dot: "var(--red)",     chart: "#B3261E" },
  effective:      { bg: "var(--green-08)",  text: "#1B5E20",             dot: "var(--green)",   chart: "#1B5E20" },
  closed:         { bg: "var(--lightgrey)", text: "rgba(14,20,60,0.55)", dot: "var(--grey)",    chart: "#9098A8" },
  withdrawn:      { bg: "var(--lightgrey)", text: "rgba(14,20,60,0.55)", dot: "var(--grey)",    chart: "#5C6478" },
};
const statusOrder = ["intake","prep","submitted","in_review","info_requested","approved","denied","effective","closed","withdrawn"];
const statusLabel = (k) => k.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase());

// ─────────────────────────────────────────────────────────────────────────────
// Icons (subset for this page)
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, className = "" }) => {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" {...stroke}/><rect x="14" y="3" width="7" height="5" {...stroke}/><rect x="14" y="12" width="7" height="9" {...stroke}/><rect x="3" y="16" width="7" height="5" {...stroke}/></>,
    clients: <><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" {...stroke}/><circle cx="10" cy="7" r="4" {...stroke}/><path d="M19 8a3 3 0 1 0-3-3" {...stroke}/></>,
    providers: <><path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...stroke}/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...stroke}/><path d="M16 3v3M14.5 4.5h3" {...stroke}/></>,
    enrollments: <><rect x="3" y="4" width="18" height="16" rx="1.5" {...stroke}/><path d="M3 9h18M8 4v16" {...stroke}/></>,
    recreds: <><circle cx="12" cy="12" r="9" {...stroke}/><path d="M12 7v5l3 2" {...stroke}/></>,
    payers: <><rect x="3" y="6" width="18" height="13" rx="1.5" {...stroke}/><path d="M3 10h18M7 15h3" {...stroke}/></>,
    documents: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...stroke}/><path d="M14 3v6h6M8 13h8M8 17h6" {...stroke}/></>,
    audit: <><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" {...stroke}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...stroke}/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" {...stroke}/></>,
    comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...stroke}/></>,
    search: <><circle cx="11" cy="11" r="7" {...stroke}/><path d="m20 20-3.5-3.5" {...stroke}/></>,
    chevron_down: <><path d="m6 9 6 6 6-6" {...stroke}/></>,
    arrow_up: <><path d="M12 19V5M5 12l7-7 7 7" {...stroke}/></>,
    arrow_down: <><path d="M12 5v14M19 12l-7 7-7-7" {...stroke}/></>,
    arrow_right: <><path d="M5 12h14M13 5l7 7-7 7" {...stroke}/></>,
    more: <><circle cx="6" cy="12" r="1.4" {...stroke}/><circle cx="12" cy="12" r="1.4" {...stroke}/><circle cx="18" cy="12" r="1.4" {...stroke}/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1.5" {...stroke}/><path d="M3 10h18M8 3v4M16 3v4" {...stroke}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{paths[name]}</svg>;
};

const StatusChip = ({ status }) => {
  const s = statusStyles[status];
  return (
    <span className="status-chip" style={{ background: s.bg, color: s.text }}>
      <span className="status-dot" style={{ background: s.dot }}/>
      <span>{statusLabel(status).toUpperCase()}</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = "var(--navy)", w = 96, h = 28 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const dx = w / (data.length - 1);
  const path = data.map((v, i) => `${i ? "L" : "M"}${(i * dx).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`).join(" ");
  const lastX = (data.length - 1) * dx;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={lastX} cy={lastY} r="2.5" fill={color}/>
    </svg>
  );
};

const KpiCard = ({ label, value, suffix, delta, deltaLabel, spark, sparkColor, isPercent }) => {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  // For info_requests, "down" is good. We'll let caller invert via CSS class — simpler: pass `goodDown` via context. Keep neutral here.
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-row">
        <div className="kpi-value">{value.toLocaleString()}{suffix && <span className="kpi-suffix">{suffix}</span>}</div>
        <Sparkline data={spark} color={sparkColor}/>
      </div>
      <div className="kpi-delta">
        <span className={`kpi-delta-tag kpi-${dir}`}>
          {dir === "up" && <Icon name="arrow_up" size={11}/>}
          {dir === "down" && <Icon name="arrow_down" size={11}/>}
          {dir === "flat" && <span>—</span>}
          <span>{delta > 0 ? "+" : ""}{delta}{isPercent ? "%" : ""}</span>
        </span>
        <span className="kpi-delta-label">{deltaLabel}</span>
      </div>
    </div>
  );
};

const LineChart = ({ data }) => {
  const W = 600, H = 260, PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 28;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const max = Math.max(...data.submitted, ...data.effective);
  const yTicks = 4;
  const stepY = Math.ceil(max / yTicks / 5) * 5 || 1;
  const yMax = stepY * yTicks;
  const dx = innerW / (data.weeks.length - 1);
  const yToPx = (v) => PAD_T + innerH - (v / yMax) * innerH;
  const linePath = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${(PAD_L + i * dx).toFixed(1)},${yToPx(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 280 }} aria-hidden>
        {/* Y gridlines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = PAD_T + (innerH / yTicks) * i;
          const v = yMax - i * stepY;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(198,204,216,0.4)" strokeWidth="1" strokeDasharray="2 4"/>
              <text x={PAD_L - 8} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(14,20,60,0.55)" fontFamily="Poppins">{v}</text>
            </g>
          );
        })}
        {/* X labels */}
        {data.weeks.map((w, i) => (
          <text key={w} x={PAD_L + i * dx} y={H - 10} textAnchor="middle" fontSize="10" fill="rgba(14,20,60,0.55)" fontFamily="Poppins">{w}</text>
        ))}
        {/* Series */}
        <path d={linePath(data.submitted)} fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={linePath(data.effective)} fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {data.submitted.map((v, i) => <circle key={`s-${i}`} cx={PAD_L + i * dx} cy={yToPx(v)} r="3" fill="var(--navy)"/>)}
        {data.effective.map((v, i) => <circle key={`e-${i}`} cx={PAD_L + i * dx} cy={yToPx(v)} r="3" fill="var(--teal)"/>)}
      </svg>
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--navy)" }}/>Submitted</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--teal)" }}/>Effective</span>
      </div>
    </div>
  );
};

const Donut = ({ data }) => {
  const total = data.reduce((a, b) => a + b.count, 0);
  const W = 240, H = 240, R = 100, IR = 70, CX = W/2, CY = H/2;
  let acc = 0;
  const ordered = statusOrder.map(k => data.find(d => d.key === k)).filter(d => d && d.count > 0);
  const slices = ordered.map((d) => {
    const start = acc / total * 2 * Math.PI - Math.PI / 2;
    acc += d.count;
    const end = acc / total * 2 * Math.PI - Math.PI / 2;
    const x1 = CX + R * Math.cos(start), y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end),   y2 = CY + R * Math.sin(end);
    const x3 = CX + IR * Math.cos(end),  y3 = CY + IR * Math.sin(end);
    const x4 = CX + IR * Math.cos(start), y4 = CY + IR * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${IR} ${IR} 0 ${large} 0 ${x4} ${y4} Z`;
    return { path, color: statusStyles[d.key].chart, key: d.key, count: d.count };
  });
  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="240" height="240" aria-hidden>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1"/>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--navy)" fontFamily="Poppins">{total.toLocaleString()}</text>
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize="9" fontWeight="600" fill="rgba(14,20,60,0.55)" fontFamily="Poppins" letterSpacing="2">TOTAL</text>
      </svg>
      <div className="donut-legend">
        {ordered.map(d => (
          <div key={d.key} className="donut-legend-row">
            <span className="donut-legend-swatch" style={{ background: statusStyles[d.key].chart }}/>
            <span className="donut-legend-label">{statusLabel(d.key)}</span>
            <span className="donut-legend-count">{d.count}</span>
            <span className="donut-legend-pct">{((d.count / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StackedBar = ({ data }) => {
  const W = 480, H = 240, PAD_L = 28, PAD_R = 12, PAD_T = 28, PAD_B = 32;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const totals = data.map(d => d.prep + d.not_started);
  const max = Math.max(...totals);
  const yTicks = 4;
  const stepY = Math.ceil(max / yTicks / 5) * 5 || 5;
  const yMax = stepY * yTicks;
  const slot = innerW / data.length;
  const barW = slot * 0.55;
  const yToPx = (v) => PAD_T + innerH - (v / yMax) * innerH;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 260 }} aria-hidden>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = PAD_T + (innerH / yTicks) * i;
          const v = yMax - i * stepY;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(198,204,216,0.4)" strokeWidth="1" strokeDasharray="2 4"/>
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(14,20,60,0.55)" fontFamily="Poppins">{v}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const total = d.prep + d.not_started;
          const yTop = yToPx(total);
          const yMid = yToPx(d.prep);
          const yBot = yToPx(0);
          return (
            <g key={d.month}>
              <rect x={cx - barW / 2} y={yMid} width={barW} height={yBot - yMid} fill="var(--teal)" rx="2"/>
              <rect x={cx - barW / 2} y={yTop} width={barW} height={yMid - yTop} fill="var(--grey)" rx="2"/>
              <text x={cx} y={yTop - 6} textAnchor="middle" fontSize="11" fontWeight="500" fill="rgba(14,20,60,0.7)" fontFamily="Poppins">{total}</text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill="rgba(14,20,60,0.7)" fontFamily="Poppins">{d.month}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--teal)" }}/>Prep</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--grey)" }}/>Not started</span>
      </div>
    </div>
  );
};

const HBar = ({ data }) => {
  const max = Math.max(...data.map(d => d.rate));
  const niceMax = Math.ceil(max / 2) * 2;
  return (
    <div className="hbar-list">
      {data.map((d) => (
        <div key={d.payer} className="hbar-row">
          <div className="hbar-label">{d.payer}</div>
          <div className="hbar-track-wrap">
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(d.rate / niceMax) * 100}%` }}/>
            </div>
            <div className="hbar-value">
              <span style={{ fontWeight: 600, color: "var(--charcoal)" }}>{d.rate.toFixed(1)}%</span>
              <span style={{ color: "rgba(14,20,60,0.5)" }}>({d.denom})</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shell pieces
// ─────────────────────────────────────────────────────────────────────────────
const TopBar = ({ viewMode }) => (
  <div className="topbar">
    <div className="flex items-center gap-7">
      <div className="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="3" width="26" height="26" rx="6" fill="var(--teal)"/>
          <path d="M11 10h6.5a6 6 0 0 1 0 12H11V10zm3.4 3v6h2.8a3 3 0 0 0 0-6h-2.8z" fill="var(--navy)"/>
        </svg>
        <span style={{ fontFamily: "Poppins", fontWeight: 600, fontSize: 16, letterSpacing: "-0.005em", color: "white" }}>Dastify</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginLeft: 4 }}>Credentialing</span>
      </div>
      <nav className="flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
        <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>Dashboard</span>
      </nav>
    </div>
    <div className="flex items-center gap-3">
      <button className="topbar-search">
        <Icon name="search" size={14}/>
        <span>Search clients, providers, payers…</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="topbar-user">
        <div className="topbar-avatar">{viewMode === "admin" ? "MA" : "IK"}</div>
        <div className="leading-tight">
          <div style={{ fontSize: 12, fontWeight: 500, color: "white" }}>{viewMode === "admin" ? "Maya Alvarez" : "Imran Khan"}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{viewMode === "admin" ? "Dastify · Admin" : "Client · Admin"}</div>
        </div>
        <Icon name="chevron_down" size={12} className="text-white/50"/>
      </div>
    </div>
  </div>
);

const Sidebar = ({ viewMode }) => {
  const adminNav = [
    { icon: "dashboard", label: "Dashboard", active: true, href: "Dashboard.html" },
    { icon: "clients", label: "Clients" },
    { icon: "providers", label: "Providers" },
    { icon: "enrollments", label: "Enrollments", href: "Enrollment Detail.html" },
    { icon: "recreds", label: "Recreds Queue", badge: 12 },
    { icon: "payers", label: "Payers" },
    { icon: "documents", label: "Documents" },
    { icon: "audit", label: "Audit Log" },
  ];
  const clientNav = [
    { icon: "dashboard", label: "Dashboard", active: true, href: "Dashboard.html" },
    { icon: "providers", label: "Providers" },
    { icon: "enrollments", label: "Enrollments", href: "Enrollment Detail.html" },
    { icon: "documents", label: "Documents" },
    { icon: "comments", label: "Comments" },
  ];
  const nav = viewMode === "admin" ? adminNav : clientNav;
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">{viewMode === "admin" ? "Workspace" : "Khan Internal Medicine"}</div>
        {nav.map((item) => (
          <a key={item.label} className={`sidebar-item ${item.active ? "is-active" : ""}`} href={item.href || "#"}>
            <Icon name={item.icon} size={16}/>
            <span>{item.label}</span>
            {item.badge != null && <span className="sidebar-badge">{item.badge}</span>}
          </a>
        ))}
      </div>
      <div className="sidebar-divider"/>
      <div className="sidebar-section">
        <a className="sidebar-item" href="#">
          <Icon name="settings" size={16}/>
          <span>Settings</span>
        </a>
      </div>
    </aside>
  );
};

const RangePicker = ({ value, onChange }) => {
  const opts = [
    { v: "30d",  l: "Last 30 days" },
    { v: "90d",  l: "Last 90 days" },
    { v: "12m",  l: "Last 12 months" },
    { v: "custom", l: "Custom" },
  ];
  return (
    <div className="range-picker">
      <Icon name="calendar" size={14}/>
      <span>Range:</span>
      <div className="range-segments">
        {opts.map(o => (
          <button key={o.v} className={`range-seg ${value === o.v ? "is-active" : ""}`} onClick={() => onChange(o.v)}>{o.l}</button>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────
const ChartCard = ({ title, caption, children }) => (
  <div className="chart-card">
    <div className="chart-head">
      <div>
        <h3 className="chart-title">{title}</h3>
        <div className="chart-caption">{caption}</div>
      </div>
      <button className="chart-more" aria-label="Chart options"><Icon name="more" size={16}/></button>
    </div>
    <div className="chart-body">{children}</div>
  </div>
);

const RecentTable = ({ rows }) => (
  <table className="dash-table">
    <thead>
      <tr>
        <th>Provider</th>
        <th>Payer</th>
        <th style={{ width: 50 }}>State</th>
        <th>Status</th>
        <th style={{ textAlign: "right" }}>Updated</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          <td style={{ fontWeight: 500 }}>{r.provider}</td>
          <td style={{ color: "rgba(14,20,60,0.7)" }}>{r.payer}</td>
          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(14,20,60,0.65)" }}>{r.state}</td>
          <td><StatusChip status={r.status}/></td>
          <td style={{ textAlign: "right", color: "rgba(14,20,60,0.55)", fontSize: 12 }}>{r.updated}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const StuckTable = ({ rows }) => (
  <table className="dash-table">
    <thead>
      <tr>
        <th>Provider</th>
        <th>Payer · State</th>
        <th style={{ textAlign: "right" }}>Days idle</th>
        <th>Last actor</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          <td style={{ fontWeight: 500 }}>{r.provider}</td>
          <td style={{ color: "rgba(14,20,60,0.7)" }}>{r.payer} · {r.state}</td>
          <td style={{ textAlign: "right" }}>
            <span className="days-idle" data-warn={r.days >= 14 ? "high" : r.days >= 7 ? "med" : "low"}>{r.days}d</span>
          </td>
          <td style={{ color: "rgba(14,20,60,0.7)" }}>{r.actor}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const CommentsList = ({ rows }) => (
  <div className="comments-list">
    {rows.map((c, i) => (
      <div key={i} className="comment-row">
        <div className="comment-row-head">
          <div className="comment-row-context">
            <span style={{ fontWeight: 600, color: "var(--charcoal)" }}>{c.provider}</span>
            <span style={{ color: "rgba(14,20,60,0.4)" }}>·</span>
            <span style={{ color: "rgba(14,20,60,0.7)" }}>{c.payer}</span>
          </div>
          <span style={{ fontSize: 11, color: "rgba(14,20,60,0.55)" }}>{c.at}</span>
        </div>
        <div className="comment-row-body">{c.excerpt}</div>
        <div className="comment-row-author">— {c.author}</div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const viewMode = t.viewMode || "admin";
  const range = t.range || "90d";
  const d = viewMode === "admin" ? adminData : clientData;

  const greeting = viewMode === "admin"
    ? "Friday, May 8 · Good morning, Maya"
    : "Friday, May 8 · Welcome back, Imran";
  const title = viewMode === "admin" ? "Dashboard" : "Khan Internal Medicine · Dashboard";

  return (
    <>
      <TopBar viewMode={viewMode}/>
      <div className="app-body">
        <Sidebar viewMode={viewMode}/>
        <main className="main">
          {viewMode === "client" && (
            <div className="disclaimer-banner">
              <div className="flex-1">
                <strong>Note from Dastify:</strong> Analytics on this dashboard are scoped to your organization's enrollments only. Reach out to your Credentialing lead with questions about specific cycles.
              </div>
              <button className="banner-dismiss" aria-label="Dismiss">×</button>
            </div>
          )}

          {/* Header */}
          <div className="page-header">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="page-title">{title}</h1>
                <div className="page-greeting">{greeting}</div>
              </div>
              <RangePicker value={range} onChange={(v) => setTweak("range", v)}/>
            </div>
          </div>

          {/* Row 1 — KPIs */}
          <div className="dash-row dash-row-kpi">
            {viewMode === "admin" ? (
              <>
                <KpiCard label="Active enrollments"      value={d.kpis.active.value}   spark={d.kpis.active.spark}   sparkColor="var(--navy)"  delta={d.kpis.active.delta}    deltaLabel={d.kpis.active.deltaLabel}/>
                <KpiCard label="Recreds due · 90 days"   value={d.kpis.recreds.value}  spark={d.kpis.recreds.spark}  sparkColor="var(--amber)" delta={d.kpis.recreds.delta}   deltaLabel={d.kpis.recreds.deltaLabel}/>
                <KpiCard label="Open info requests"      value={d.kpis.info_req.value} spark={d.kpis.info_req.spark} sparkColor="var(--amber)" delta={d.kpis.info_req.delta}  deltaLabel={d.kpis.info_req.deltaLabel}/>
                <KpiCard label="Avg time-to-effective"   value={d.kpis.tte.value}      suffix="d" spark={d.kpis.tte.spark}      sparkColor="var(--teal)"  delta={d.kpis.tte.delta}       deltaLabel={d.kpis.tte.deltaLabel}/>
              </>
            ) : (
              <>
                <KpiCard label="Active enrollments"      value={d.kpis.active.value}   spark={d.kpis.active.spark}   sparkColor="var(--navy)"  delta={d.kpis.active.delta}    deltaLabel={d.kpis.active.deltaLabel}/>
                <KpiCard label="Recreds due · 90 days"   value={d.kpis.recreds.value}  spark={d.kpis.recreds.spark}  sparkColor="var(--amber)" delta={d.kpis.recreds.delta}   deltaLabel={d.kpis.recreds.deltaLabel}/>
                <KpiCard label="Open info requests"      value={d.kpis.info_req.value} spark={d.kpis.info_req.spark} sparkColor="var(--amber)" delta={d.kpis.info_req.delta}  deltaLabel={d.kpis.info_req.deltaLabel}/>
                <KpiCard label="Recent comments"         value={d.kpis.comments.value} spark={d.kpis.comments.spark} sparkColor="var(--teal)"  delta={d.kpis.comments.delta}  deltaLabel={d.kpis.comments.deltaLabel}/>
              </>
            )}
          </div>

          {/* Row 2 — Throughput + status mix */}
          <div className="dash-row dash-row-65-35">
            <ChartCard title={`Throughput · ${range === "30d" ? "last 30 days" : range === "12m" ? "last 12 months" : "last 90 days"}`}
                       caption={viewMode === "admin" ? "Enrollments transitioning per week, all clients." : "Your enrollments transitioning per week."}>
              <LineChart data={d.throughput}/>
            </ChartCard>
            <ChartCard title="Active by status"
                       caption={viewMode === "admin" ? "Snapshot — current. Click a slice to filter the list." : "Snapshot — your enrollments."}>
              <Donut data={d.status}/>
            </ChartCard>
          </div>

          {/* Row 3 — risk surfaces */}
          {viewMode === "admin" ? (
            <div className="dash-row dash-row-50-50">
              <ChartCard title="Recreds due · next 6 months" caption="Stacked by current prep status. Window is fixed forward — ignores range picker.">
                <StackedBar data={d.recredForecast}/>
              </ChartCard>
              <ChartCard title="Denial rate · top 10 payers" caption="By denominator: total submissions in range.">
                <HBar data={d.denialRate}/>
              </ChartCard>
            </div>
          ) : (
            <div className="dash-row dash-row-1">
              <ChartCard title="Recreds due · next 6 months" caption="Your enrollments only. Stacked by prep status.">
                <StackedBar data={d.recredForecast}/>
              </ChartCard>
            </div>
          )}

          {/* Row 4 — operational queues */}
          <div className="dash-row dash-row-50-50">
            <ChartCard title="Recently updated enrollments" caption="Last 8 transitions or comments. Click a row to open the enrollment.">
              <RecentTable rows={d.recentlyUpdated}/>
              <div className="card-footer-link"><a href="#">View all →</a></div>
            </ChartCard>
            {viewMode === "admin" ? (
              <ChartCard title="Stuck in info_requested" caption="Sorted by days idle desc. Drill in to chase.">
                <StuckTable rows={d.stuck}/>
                <div className="card-footer-link"><a href="#">View all →</a></div>
              </ChartCard>
            ) : (
              <ChartCard title="Recent comments" caption="Latest 5 comments across your enrollments.">
                <CommentsList rows={d.recentComments}/>
                <div className="card-footer-link"><a href="#">View all →</a></div>
              </ChartCard>
            )}
          </div>
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="View as">
          <TweakRadio
            value={viewMode}
            onChange={(v) => setTweak("viewMode", v)}
            options={[
              { value: "admin", label: "Admin" },
              { value: "client", label: "Client" },
            ]}
          />
          <div style={{ fontSize: 11, color: "rgba(14,20,60,0.55)", marginTop: 8, lineHeight: 1.5 }}>
            Client view scopes all data to one practice (Khan Internal Medicine). Per-payer denial analytics are removed; the "Stuck" queue is replaced with recent comments.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
