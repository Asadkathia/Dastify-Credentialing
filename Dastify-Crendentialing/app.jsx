/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio */
const { useState, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewMode": "admin",
  "tab": "overview"
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data (fictional; matches §13 example)
// ─────────────────────────────────────────────────────────────────────────────
const data = {
  client: { name: "Khan Internal Medicine", code: "KIM-0218" },
  provider: {
    name: "Dr. Imran Khan, MD",
    npi: "1497823004",
    specialty: "Internal Medicine",
    dea: "BK4827193",
    ssn4: "4821",
    dob: "1979-04-12",
    taxId: "84-2917403",
  },
  enrollment: {
    payer: "Aetna",
    payerCode: "AET-COM-2025",
    state: "TX",
    cycle: 2,
    status: "in_review",
    subStatus: "Awaiting payer credentialing committee",
    submittedDate: "2026-02-14",
    effectiveDate: null,
    nextRecredDue: "2026-06-25",
    daysToRecred: 47,
    parentEnrollmentId: "ENR-001824",
    enrollmentId: "ENR-002193",
  },
  pipeline: [
    { key: "intake", label: "Intake" },
    { key: "prep", label: "Prep" },
    { key: "submitted", label: "Submitted" },
    { key: "in_review", label: "In Review" },
    { key: "info_requested", label: "Info Requested" },
    { key: "approved", label: "Approved" },
    { key: "denied", label: "Denied" },
    { key: "effective", label: "Effective" },
    { key: "closed", label: "Closed" },
    { key: "withdrawn", label: "Withdrawn" },
  ],
  statusHistory: [
    { at: "2026-04-22 09:14", actor: "M. Alvarez (Dastify)", from: "submitted", to: "in_review", note: "Aetna acknowledged receipt; assigned to credentialing committee for Q2 review window." },
    { at: "2026-02-14 15:02", actor: "M. Alvarez (Dastify)", from: "prep", to: "submitted", note: "Application submitted via Aetna provider portal. Confirmation #AET-7742-0214." },
    { at: "2026-02-09 11:40", actor: "S. Park (Dastify)", from: "intake", to: "prep", note: "CAQH attestation refreshed. License + DEA verified." },
    { at: "2026-01-28 16:20", actor: "S. Park (Dastify)", from: null, to: "intake", note: "Cycle 2 enrollment opened; recredentialing period begins." },
  ],
  documents: [
    { name: "CAQH Application — Cycle 2", type: "pdf", size: "2.4 MB", uploader: "S. Park", ago: "12d", category: "Application", expires: "2027-01-28", days: 631, internal: false },
    { name: "TX Medical License — 2026", type: "pdf", size: "412 KB", uploader: "S. Park", ago: "12d", category: "License", expires: "2026-12-31", days: 237, internal: false },
    { name: "DEA Registration", type: "pdf", size: "189 KB", uploader: "S. Park", ago: "12d", category: "License", expires: "2027-08-31", days: 481, internal: false },
    { name: "Malpractice COI — Aetna addendum", type: "pdf", size: "892 KB", uploader: "M. Alvarez", ago: "9d", category: "Insurance", expires: "2026-09-30", days: 145, internal: false },
    { name: "Internal — Aetna comm. log Q1", type: "pdf", size: "118 KB", uploader: "M. Alvarez", ago: "5d", category: "Notes", expires: null, days: null, internal: true },
  ],
  comments: [
    { author: "Maya Alvarez", role: "Dastify · Credentialing", at: "3d ago", body: "Aetna confirmed the file is complete and queued for the May 14 committee review. We expect a determination within 10–14 business days after that date.", avatar: "MA", roleColor: "navy" },
    { author: "Imran Khan", role: "Khan Internal Medicine · Admin", at: "5d ago", body: "Thanks for the update. Let me know if anything else is needed from our side before the committee meets.", avatar: "IK", roleColor: "teal" },
    { author: "Maya Alvarez", role: "Dastify · Credentialing", at: "8d ago", body: "Quick note — Aetna's portal showed the submission was received and assigned to credentialing on April 22. Sub-status updated.", avatar: "MA", roleColor: "navy" },
  ],
  internalNotes: [
    { author: "M. Alvarez", at: "3d ago", body: "Reviewer for this cycle is K. Whitfield at Aetna — same reviewer as KIM-0218 cycle 1. Tends to flag malpractice limits; ours are within range." },
    { author: "S. Park", at: "12d ago", body: "Confirmed Aetna-TX uses the CAQH-only path; no supplemental form needed for this cycle." },
  ],
  activity: [
    { at: "2026-05-06 10:21", actor: "M. Alvarez", action: "added a comment", entity: "Comment #c-9214" },
    { at: "2026-05-04 14:08", actor: "M. Alvarez", action: "uploaded document", entity: "Internal — Aetna comm. log Q1" },
    { at: "2026-04-30 09:15", actor: "I. Khan", action: "added a comment", entity: "Comment #c-9203" },
    { at: "2026-04-22 09:14", actor: "M. Alvarez", action: "transitioned status", entity: "submitted → in_review" },
    { at: "2026-04-22 09:14", actor: "M. Alvarez", action: "updated sub-status", entity: "Awaiting payer credentialing committee" },
    { at: "2026-02-14 15:02", actor: "M. Alvarez", action: "uploaded document", entity: "Malpractice COI — Aetna addendum" },
    { at: "2026-02-14 15:02", actor: "M. Alvarez", action: "transitioned status", entity: "prep → submitted" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Status color mapping (§4.1)
// ─────────────────────────────────────────────────────────────────────────────
const statusStyles = {
  intake:         { bg: "var(--lightgrey)",  text: "var(--charcoal)",          dot: "var(--grey)" },
  prep:           { bg: "var(--teal-08)",    text: "var(--navy)",              dot: "var(--aqua)" },
  submitted:      { bg: "var(--teal-08)",    text: "var(--navy)",              dot: "var(--teal)" },
  in_review:      { bg: "var(--teal-08)",    text: "var(--navy)",              dot: "var(--teal)" },
  info_requested: { bg: "var(--amber-08)",   text: "var(--charcoal)",          dot: "var(--amber)" },
  approved:       { bg: "var(--green-08)",   text: "#1B5E20",                  dot: "var(--green)" },
  denied:         { bg: "var(--red-08)",     text: "var(--red)",               dot: "var(--red)" },
  effective:      { bg: "var(--green-08)",   text: "#1B5E20",                  dot: "var(--green)" },
  closed:         { bg: "var(--lightgrey)",  text: "rgba(14,20,60,0.55)",      dot: "var(--grey)" },
  withdrawn:      { bg: "var(--lightgrey)",  text: "rgba(14,20,60,0.55)",      dot: "var(--grey)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tiny icon set — thin-line SVGs (2px stroke, currentColor)
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
    settings: <><circle cx="12" cy="12" r="3" {...stroke}/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.39.16.74.4 1.02.7" {...stroke}/></>,
    comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...stroke}/></>,
    search: <><circle cx="11" cy="11" r="7" {...stroke}/><path d="m20 20-3.5-3.5" {...stroke}/></>,
    chevron_right: <><path d="m9 6 6 6-6 6" {...stroke}/></>,
    chevron_down: <><path d="m6 9 6 6 6-6" {...stroke}/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" {...stroke}/><circle cx="12" cy="12" r="3" {...stroke}/></>,
    eye_off: <><path d="M17.94 17.94A10.06 10.06 0 0 1 12 19c-6.5 0-10-7-10-7a17.74 17.74 0 0 1 4.06-4.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a17.83 17.83 0 0 1-2.16 3.19M2 2l20 20M9.88 9.88a3 3 0 0 0 4.24 4.24" {...stroke}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...stroke}/></>,
    upload: <><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5 5 5M12 4v12" {...stroke}/></>,
    more: <><circle cx="6" cy="12" r="1.4" {...stroke}/><circle cx="12" cy="12" r="1.4" {...stroke}/><circle cx="18" cy="12" r="1.4" {...stroke}/></>,
    pdf: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...stroke}/><path d="M14 3v6h6" {...stroke}/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1.5" {...stroke}/><path d="M3 10h18M8 3v4M16 3v4" {...stroke}/></>,
    warning: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" {...stroke}/></>,
    arrow_right: <><path d="M5 12h14M13 5l7 7-7 7" {...stroke}/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" {...stroke}/></>,
    check: <><path d="M5 12l5 5L20 7" {...stroke}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{paths[name]}</svg>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────────────────
const StatusChip = ({ status, size = "sm" }) => {
  const s = statusStyles[status];
  const label = status.replace("_", "_").toUpperCase();
  return (
    <span className="status-chip" style={{ background: s.bg, color: s.text, padding: size === "lg" ? "6px 12px" : "4px 10px", fontSize: size === "lg" ? 12 : 11 }}>
      <span className="status-dot" style={{ background: s.dot }}/>
      <span>{label}</span>
    </span>
  );
};

const Btn = ({ variant = "primary", size = "md", icon, children, ...rest }) => (
  <button className={`btn btn-${variant} btn-${size}`} {...rest}>
    {icon && <Icon name={icon} size={14}/>}
    {children}
  </button>
);

const Crumb = ({ items }) => (
  <nav className="flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
    {items.map((it, i) => (
      <React.Fragment key={i}>
        <span style={{ color: i === items.length - 1 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)", fontWeight: i === items.length - 1 ? 500 : 400 }}>{it}</span>
        {i < items.length - 1 && <span style={{ color: "rgba(255,255,255,0.3)" }}>›</span>}
      </React.Fragment>
    ))}
  </nav>
);

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────
const TopBar = ({ viewMode }) => {
  const adminCrumbs = ["Clients", "Khan Internal Medicine", "Dr. Imran Khan", "Aetna · TX · Cycle 2"];
  const clientCrumbs = ["Enrollments", "Dr. Imran Khan", "Aetna · TX · Cycle 2"];
  return (
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
        <Crumb items={viewMode === "admin" ? adminCrumbs : clientCrumbs}/>
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
const Sidebar = ({ viewMode }) => {
  const adminNav = [
    { icon: "dashboard", label: "Dashboard" },
    { icon: "clients", label: "Clients" },
    { icon: "providers", label: "Providers" },
    { icon: "enrollments", label: "Enrollments", active: true },
    { icon: "recreds", label: "Recreds Queue", badge: 12 },
    { icon: "payers", label: "Payers" },
    { icon: "documents", label: "Documents" },
    { icon: "audit", label: "Audit Log" },
  ];
  const clientNav = [
    { icon: "dashboard", label: "Dashboard" },
    { icon: "providers", label: "Providers" },
    { icon: "enrollments", label: "Enrollments", active: true },
    { icon: "documents", label: "Documents" },
    { icon: "comments", label: "Comments" },
  ];
  const nav = viewMode === "admin" ? adminNav : clientNav;
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">{viewMode === "admin" ? "Workspace" : "Khan Internal Medicine"}</div>
        {nav.map((item) => (
          <a key={item.label} className={`sidebar-item ${item.active ? "is-active" : ""}`} href="#">
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

// ─────────────────────────────────────────────────────────────────────────────
// Status pipeline (10-stage)
// ─────────────────────────────────────────────────────────────────────────────
const Pipeline = ({ current }) => {
  // Visible path: intake → prep → submitted → in_review → info_requested → approved → effective → closed
  // Branch alts: denied (between approved and effective), withdrawn (terminal)
  const main = ["intake", "prep", "submitted", "in_review", "info_requested", "approved", "effective", "closed"];
  const currentIdx = main.indexOf(current);
  const stageLabels = {
    intake: "Intake", prep: "Prep", submitted: "Submitted", in_review: "In Review",
    info_requested: "Info Req.", approved: "Approved", effective: "Effective", closed: "Closed",
  };
  return (
    <div className="pipeline">
      <div className="pipeline-track">
        {main.map((stage, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const dotColor = isPast ? "var(--green)" : isCurrent ? "var(--teal)" : "var(--grey)";
          return (
            <React.Fragment key={stage}>
              <div className={`pipeline-step ${isCurrent ? "is-current" : ""}`}>
                <div className="pipeline-dot" style={{ background: dotColor, boxShadow: isCurrent ? "0 0 0 4px var(--teal-12)" : "none" }}>
                  {isPast && <Icon name="check" size={10} className="text-white"/>}
                </div>
                <div className="pipeline-label" style={{ color: isCurrent ? "var(--navy)" : isFuture ? "rgba(14,20,60,0.4)" : "rgba(14,20,60,0.7)", fontWeight: isCurrent ? 600 : 500 }}>{stageLabels[stage]}</div>
              </div>
              {i < main.length - 1 && (
                <div className="pipeline-line" style={{ background: i < currentIdx ? "var(--green)" : "var(--grey)" }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="pipeline-branches">
        <span className="pipeline-branch-label">Alternate terminals:</span>
        <span className="pipeline-branch-tag" style={{ color: "var(--red)", borderColor: "rgba(179,38,30,0.3)" }}>Denied</span>
        <span className="pipeline-branch-tag" style={{ color: "rgba(14,20,60,0.55)", borderColor: "rgba(14,20,60,0.15)" }}>Withdrawn</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive field with reveal affordance
// ─────────────────────────────────────────────────────────────────────────────
const SensitiveField = ({ label, value, mask = "•••• ••••", canReveal = true }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="kv">
      <div className="kv-label">{label}</div>
      <div className="kv-value flex items-center gap-2">
        <span className={revealed ? "" : "font-mono tracking-wider"} style={{ fontFamily: revealed ? "Poppins, sans-serif" : "'JetBrains Mono', ui-monospace, monospace" }}>
          {revealed ? value : mask}
        </span>
        {canReveal ? (
          <button onClick={() => setRevealed(!revealed)} className="reveal-btn" aria-label={revealed ? "Hide" : "Reveal"}>
            <Icon name={revealed ? "eye_off" : "eye"} size={12}/>
            <span>{revealed ? "Hide" : "Reveal"}</span>
          </button>
        ) : (
          <span className="reveal-locked">
            <Icon name="eye_off" size={12}/>
            <span>Restricted</span>
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = ({ tabs, active, onChange }) => (
  <div className="tabbar">
    {tabs.map((t) => (
      <button key={t.key} className={`tab ${active === t.key ? "is-active" : ""}`} onClick={() => onChange(t.key)}>
        {t.label}
        {t.count != null && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page header
// ─────────────────────────────────────────────────────────────────────────────
const PageHeader = ({ viewMode }) => {
  const e = data.enrollment;
  return (
    <div className="page-header">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--teal)" }}>
            <span>Enrollment</span>
            <span style={{ color: "rgba(14,20,60,0.3)" }}>·</span>
            <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(14,20,60,0.55)", letterSpacing: 0 }}>{e.enrollmentId}</span>
          </div>
          <h1 className="page-title">
            Dr. Imran Khan <span style={{ color: "rgba(14,20,60,0.35)", fontWeight: 400, margin: "0 8px" }}>·</span> Aetna
            <span style={{ color: "rgba(14,20,60,0.35)", fontWeight: 400, margin: "0 8px" }}>·</span> Texas
            <span style={{ color: "rgba(14,20,60,0.35)", fontWeight: 400, margin: "0 8px" }}>·</span>
            <span style={{ fontWeight: 500 }}>Cycle 2</span>
          </h1>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <StatusChip status="in_review" size="lg"/>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(14,20,60,0.55)" }}>Sub-status:</span>
            <span style={{ fontSize: 13, color: "var(--charcoal)", fontWeight: 500 }}>{e.subStatus}</span>
          </div>
          <div className="recred-banner mt-4">
            <Icon name="warning" size={14}/>
            <span><strong>Recred due in {e.daysToRecred} days</strong> — next cycle window opens {e.nextRecredDue}. Linked from <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12 }}>{e.parentEnrollmentId}</span> (Cycle 1).</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {viewMode === "admin" ? (
            <>
              <Btn variant="primary" icon="arrow_right">Transition status</Btn>
              <Btn variant="secondary" icon="upload">Upload document</Btn>
              <Btn variant="secondary" icon="comments">Add comment</Btn>
              <button className="btn btn-ghost btn-md" aria-label="More actions"><Icon name="more" size={16}/></button>
            </>
          ) : (
            <Btn variant="primary" icon="comments">Add comment</Btn>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab content panels
// ─────────────────────────────────────────────────────────────────────────────
const OverviewPanel = ({ viewMode }) => {
  const e = data.enrollment;
  const p = data.provider;
  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Pipeline</h3>
            <div className="panel-caption">Current stage of this enrollment cycle. Past stages are confirmed; alternate terminals shown below.</div>
          </div>
        </div>
        <Pipeline current={e.status}/>
      </section>

      <section className="col-span-7 panel">
        <div className="panel-head">
          <h3 className="panel-title">Enrollment</h3>
          <button className="panel-action">Edit</button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div className="kv"><div className="kv-label">Subject</div><div className="kv-value">{p.name}</div><div className="kv-meta">Provider · Internal Medicine</div></div>
          <div className="kv"><div className="kv-label">Payer</div><div className="kv-value">Aetna</div><div className="kv-meta" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{e.payerCode}</div></div>
          <div className="kv"><div className="kv-label">State</div><div className="kv-value">Texas</div><div className="kv-meta">TX · commercial line</div></div>
          <div className="kv"><div className="kv-label">Cycle</div><div className="kv-value">Cycle {e.cycle}</div><div className="kv-meta">Linked to <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{e.parentEnrollmentId}</span></div></div>
          <div className="kv"><div className="kv-label">Submitted</div><div className="kv-value">{e.submittedDate}</div><div className="kv-meta">81 days ago</div></div>
          <div className="kv"><div className="kv-label">Effective date</div><div className="kv-value" style={{ color: "rgba(14,20,60,0.4)" }}>—</div><div className="kv-meta">Set on transition to <em>effective</em></div></div>
          <div className="kv"><div className="kv-label">Recred due</div><div className="kv-value">{e.nextRecredDue}</div><div className="kv-meta" style={{ color: "var(--amber)", fontWeight: 500 }}>{e.daysToRecred} days · within window</div></div>
          <div className="kv"><div className="kv-label">Owner</div><div className="kv-value">M. Alvarez</div><div className="kv-meta">Dastify · Credentialing</div></div>
        </div>
      </section>

      <section className="col-span-5 panel">
        <div className="panel-head">
          <h3 className="panel-title">Provider record</h3>
          <a href="#" className="panel-action">Open</a>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <div className="kv col-span-2"><div className="kv-label">Name</div><div className="kv-value">{p.name}</div></div>
          <div className="kv"><div className="kv-label">NPI</div><div className="kv-value" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{p.npi}</div></div>
          <div className="kv"><div className="kv-label">Specialty</div><div className="kv-value">{p.specialty}</div></div>
          {viewMode === "admin" ? (
            <>
              <SensitiveField label="DEA" value={p.dea} mask="••••••••"/>
              <SensitiveField label="SSN-last-4" value={p.ssn4} mask="••••"/>
              <SensitiveField label="Date of birth" value={p.dob} mask="••••-••-••"/>
              <SensitiveField label="Tax ID" value={p.taxId} mask="••-•••••••"/>
            </>
          ) : (
            <>
              <SensitiveField label="DEA" canReveal={false} mask="••••••••"/>
              <SensitiveField label="SSN-last-4" canReveal={false} mask="••••"/>
              <SensitiveField label="Date of birth" canReveal={false} mask="••••-••-••"/>
              <SensitiveField label="Tax ID" canReveal={false} mask="••-•••••••"/>
            </>
          )}
        </div>
        {viewMode === "admin" && (
          <div className="reveal-disclaimer">
            <Icon name="warning" size={12}/>
            Sensitive fields are encrypted at rest. Reveals are audit-logged.
          </div>
        )}
      </section>

      <section className="col-span-12 panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Recent activity</h3>
            <div className="panel-caption">Most recent {viewMode === "admin" ? 5 : 4} events on this enrollment.</div>
          </div>
          <a href="#" className="panel-action">View all activity</a>
        </div>
        <div className="timeline">
          {data.activity.slice(0, viewMode === "admin" ? 5 : 4).map((ev, i) => (
            <div key={i} className="timeline-row">
              <div className="timeline-dot" style={{ background: ev.action.includes("transition") ? "var(--teal)" : ev.action.includes("comment") ? "var(--aqua)" : "var(--grey)" }}/>
              <div className="timeline-content">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--charcoal)" }}>{ev.actor}</span>
                  <span style={{ fontSize: 13, color: "rgba(14,20,60,0.65)" }}>{ev.action}</span>
                  <span style={{ fontSize: 13, color: "var(--charcoal)", fontWeight: 500 }}>{ev.entity}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(14,20,60,0.5)", marginTop: 2, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{ev.at}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const StatusHistoryPanel = () => (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h3 className="panel-title">Status history</h3>
        <div className="panel-caption">Append-only timeline of status transitions for Cycle 2.</div>
      </div>
    </div>
    <div className="status-timeline">
      {data.statusHistory.map((row, i) => (
        <div key={i} className="status-timeline-row">
          <div className="status-timeline-rail">
            <div className="status-timeline-dot" style={{ background: statusStyles[row.to].dot }}/>
            {i < data.statusHistory.length - 1 && <div className="status-timeline-line"/>}
          </div>
          <div className="flex-1 pb-7">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              {row.from && (
                <>
                  <StatusChip status={row.from}/>
                  <Icon name="arrow_right" size={12} className="text-navy/40"/>
                </>
              )}
              <StatusChip status={row.to}/>
              <span style={{ fontSize: 12, color: "rgba(14,20,60,0.5)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginLeft: "auto" }}>{row.at}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--charcoal)", lineHeight: 1.6 }}>{row.note}</div>
            <div style={{ fontSize: 12, color: "rgba(14,20,60,0.55)", marginTop: 4 }}>by {row.actor}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const DocumentsPanel = ({ viewMode }) => {
  const docs = data.documents.filter(d => viewMode === "admin" || !d.internal);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3 className="panel-title">Documents</h3>
          <div className="panel-caption">{docs.length} files attached to this enrollment.</div>
        </div>
        {viewMode === "admin" && <Btn variant="secondary" size="sm" icon="upload">Upload</Btn>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {docs.map((d, i) => (
          <div key={i} className="doc-card">
            <div className="doc-icon"><Icon name="pdf" size={18}/></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="doc-name">{d.name}</div>
                  <div className="doc-meta">{d.type.toUpperCase()} · {d.size} · uploaded by {d.uploader} · {d.ago} ago</div>
                </div>
                <button className="doc-more" aria-label="More"><Icon name="more" size={14}/></button>
              </div>
              <div className="doc-divider"/>
              <div className="flex items-center gap-3 flex-wrap text-[12px]">
                <span style={{ color: "rgba(14,20,60,0.55)" }}>Category</span>
                <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>{d.category}</span>
                {d.expires && <>
                  <span style={{ color: "rgba(14,20,60,0.3)" }}>·</span>
                  <span style={{ color: "rgba(14,20,60,0.55)" }}>Expires</span>
                  <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>{d.expires}</span>
                  <span style={{ color: d.days < 30 ? "var(--red)" : d.days < 180 ? "var(--amber)" : "rgba(14,20,60,0.5)" }}>· {d.days}d</span>
                </>}
                {d.internal && <span className="doc-internal-badge">Internal</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const CommentsPanel = ({ viewMode }) => (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h3 className="panel-title">Comments</h3>
        <div className="panel-caption">Client-visible discussion thread. Reverse chronological.</div>
      </div>
    </div>
    <div className="comments">
      {data.comments.map((c, i) => (
        <div key={i} className="comment">
          <div className="comment-avatar" style={{ background: c.roleColor === "navy" ? "var(--navy)" : "var(--teal)" }}>{c.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)" }}>{c.author}</span>
              <span className="comment-role" style={{ background: c.roleColor === "navy" ? "var(--navy-08)" : "var(--teal-08)", color: c.roleColor === "navy" ? "var(--navy)" : "#0E7475" }}>{c.role}</span>
              <span style={{ fontSize: 12, color: "rgba(14,20,60,0.5)", marginLeft: "auto" }}>{c.at}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--charcoal)", lineHeight: 1.6, marginTop: 6 }}>{c.body}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="composer">
      <div className="composer-avatar" style={{ background: viewMode === "admin" ? "var(--navy)" : "var(--teal)" }}>{viewMode === "admin" ? "MA" : "IK"}</div>
      <div className="flex-1">
        <div className="composer-input">Write a comment to the {viewMode === "admin" ? "client" : "Dastify team"}…</div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-[11px]" style={{ color: "rgba(14,20,60,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>Visible to all parties on this enrollment</div>
          <Btn variant="primary" size="sm">Post comment</Btn>
        </div>
      </div>
    </div>
  </section>
);

const InternalNotesPanel = () => (
  <section className="panel" style={{ background: "var(--amber-08)", borderColor: "rgba(244,163,0,0.3)" }}>
    <div className="panel-head">
      <div>
        <h3 className="panel-title">Internal notes</h3>
        <div className="panel-caption" style={{ color: "rgba(14,20,60,0.7)" }}>
          <Icon name="warning" size={12} className="inline-block mr-1" style={{ color: "var(--amber)" }}/>
          Admin-only. Never visible to client. Append-only.
        </div>
      </div>
      <Btn variant="secondary" size="sm" icon="plus">Add note</Btn>
    </div>
    <div className="space-y-4">
      {data.internalNotes.map((n, i) => (
        <div key={i} className="internal-note">
          <div className="flex items-baseline gap-2 mb-1">
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--charcoal)" }}>{n.author}</span>
            <span className="comment-role" style={{ background: "rgba(244,163,0,0.18)", color: "#7a4f00" }}>Internal</span>
            <span style={{ fontSize: 12, color: "rgba(14,20,60,0.5)", marginLeft: "auto" }}>{n.at}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--charcoal)", lineHeight: 1.6 }}>{n.body}</div>
        </div>
      ))}
    </div>
  </section>
);

const ActivityPanel = () => (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h3 className="panel-title">Activity</h3>
        <div className="panel-caption">Full append-only event log for this enrollment.</div>
      </div>
    </div>
    <table className="data-table">
      <thead>
        <tr>
          <th style={{ width: 180 }}>Timestamp</th>
          <th style={{ width: 160 }}>Actor</th>
          <th>Action</th>
          <th>Entity</th>
        </tr>
      </thead>
      <tbody>
        {data.activity.map((ev, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: "rgba(14,20,60,0.65)" }}>{ev.at}</td>
            <td style={{ fontWeight: 500 }}>{ev.actor}</td>
            <td style={{ color: "rgba(14,20,60,0.7)" }}>{ev.action}</td>
            <td style={{ fontWeight: 500 }}>{ev.entity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const viewMode = t.viewMode || "admin";
  const [tab, setTab] = useState("overview");

  const adminTabs = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Status history", count: data.statusHistory.length },
    { key: "documents", label: "Documents", count: data.documents.length },
    { key: "comments", label: "Comments", count: data.comments.length },
    { key: "internal", label: "Internal notes", count: data.internalNotes.length },
    { key: "activity", label: "Activity" },
  ];
  const clientTabs = [
    { key: "overview", label: "Overview" },
    { key: "history", label: "Status history", count: data.statusHistory.length },
    { key: "documents", label: "Documents", count: data.documents.filter(d => !d.internal).length },
    { key: "comments", label: "Comments", count: data.comments.length },
    { key: "activity", label: "Activity" },
  ];
  const tabs = viewMode === "admin" ? adminTabs : clientTabs;

  // If user switches to client and is on internal tab, fall back
  const safeTab = useMemo(() => {
    if (viewMode === "client" && tab === "internal") return "overview";
    return tab;
  }, [viewMode, tab]);

  return (
    <>
      <TopBar viewMode={viewMode}/>
      <div className="app-body">
        <Sidebar viewMode={viewMode}/>
        <main className="main">
          {viewMode === "client" && (
            <div className="disclaimer-banner">
              <div className="flex-1">
                <strong>Note from Dastify:</strong> Sensitive provider fields (DEA, SSN, DOB, Tax ID) are masked and not retrievable in the client portal. Reach out to your Credentialing lead if you need to update them.
              </div>
              <button className="banner-dismiss" aria-label="Dismiss">×</button>
            </div>
          )}
          <PageHeader viewMode={viewMode}/>
          <TabBar tabs={tabs} active={safeTab} onChange={setTab}/>
          <div className="tab-panel">
            {safeTab === "overview" && <OverviewPanel viewMode={viewMode}/>}
            {safeTab === "history" && <StatusHistoryPanel/>}
            {safeTab === "documents" && <DocumentsPanel viewMode={viewMode}/>}
            {safeTab === "comments" && <CommentsPanel viewMode={viewMode}/>}
            {safeTab === "internal" && viewMode === "admin" && <InternalNotesPanel/>}
            {safeTab === "activity" && <ActivityPanel/>}
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
            Switches between Dastify staff view and the practice's read-only portal. Internal notes, sensitive reveals, and admin actions are removed in client view.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
