/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio */
const { useState, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewMode": "admin",
  "density": "comfortable"
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data — 28 enrollments, mix of statuses, days idle, recred dates
// ─────────────────────────────────────────────────────────────────────────────
const allRows = [
  { id: "ENR-104822", provider: "Dr. Imran Khan",       client: "Khan Internal Medicine",    payer: "Aetna",     state: "TX", status: "in_review",      sub: "Committee review",      idle: 4,  updated: "2h ago",  assignee: "M. Alvarez", recred: "2026-04-22", cycle: 2 },
  { id: "ENR-104791", provider: "Dr. Sarah Chen",       client: "Bayview Medical Group",     payer: "BCBS — TX", state: "TX", status: "approved",       sub: "Awaiting eff. date",    idle: 2,  updated: "4h ago",  assignee: "S. Park",    recred: "2027-01-14", cycle: 1 },
  { id: "ENR-104713", provider: "Dr. Marcus Patel",     client: "Bayview Medical Group",     payer: "UHC",       state: "CA", status: "info_requested", sub: "Malpractice COI",       idle: 12, updated: "6h ago",  assignee: "M. Alvarez", recred: "2026-08-30", cycle: 1 },
  { id: "ENR-104688", provider: "Dr. Lina Rodriguez",   client: "Coastline Cardiology",      payer: "Humana",    state: "FL", status: "submitted",      sub: "Acknowledgment pending", idle: 6,  updated: "8h ago",  assignee: "S. Park",    recred: "2027-03-02", cycle: 1 },
  { id: "ENR-104651", provider: "Dr. James Okonkwo",    client: "Northstar Pediatrics",      payer: "Cigna",     state: "NY", status: "prep",           sub: "CAQH attestation",      idle: 3,  updated: "12h ago", assignee: "S. Park",    recred: "2026-11-10", cycle: 1 },
  { id: "ENR-104612", provider: "Dr. Priya Suri",       client: "Anthem-Linked Allergy",     payer: "Anthem",    state: "CA", status: "effective",      sub: "—",                     idle: 32, updated: "1d ago",  assignee: "M. Alvarez", recred: "2027-05-30", cycle: 1 },
  { id: "ENR-104578", provider: "Dr. Daniel Park",      client: "Hudson Family Medicine",    payer: "Aetna",     state: "NY", status: "in_review",      sub: "Initial review",        idle: 7,  updated: "1d ago",  assignee: "S. Park",    recred: "2026-09-15", cycle: 2 },
  { id: "ENR-104544", provider: "Dr. Olivia Reyes",     client: "Pacific Coast Surgery",     payer: "BCBS — CA", state: "CA", status: "approved",       sub: "Welcome packet sent",   idle: 18, updated: "2d ago",  assignee: "M. Alvarez", recred: "2027-02-08", cycle: 1 },
  { id: "ENR-104511", provider: "Dr. Robert Lee",       client: "Hudson Family Medicine",    payer: "UHC",       state: "NY", status: "info_requested", sub: "Hospital privileges",   idle: 18, updated: "2d ago",  assignee: "M. Alvarez", recred: "2026-07-05", cycle: 2 },
  { id: "ENR-104488", provider: "Dr. Aisha Taylor",     client: "Coastline Cardiology",      payer: "Cigna",     state: "TX", status: "info_requested", sub: "DEA cert. update",      idle: 14, updated: "3d ago",  assignee: "S. Park",    recred: "2026-10-12", cycle: 1 },
  { id: "ENR-104452", provider: "Dr. Erin Wallace",     client: "Coastline Cardiology",      payer: "Humana",    state: "FL", status: "info_requested", sub: "Specialty board cert.", idle: 11, updated: "3d ago",  assignee: "S. Park",    recred: "2026-12-04", cycle: 1 },
  { id: "ENR-104421", provider: "Dr. Hugo Mendez",      client: "Khan Internal Medicine",    payer: "Aetna",     state: "TX", status: "info_requested", sub: "Address verification",  idle: 9,  updated: "4d ago",  assignee: "M. Alvarez", recred: "2026-08-20", cycle: 1 },
  { id: "ENR-104390", provider: "Dr. Yara Nasser",      client: "Anthem-Linked Allergy",     payer: "Anthem",    state: "CA", status: "info_requested", sub: "Reference contact",     idle: 8,  updated: "4d ago",  assignee: "S. Park",    recred: "2027-01-25", cycle: 1 },
  { id: "ENR-104351", provider: "Dr. Tomás Soto",       client: "Bayview Medical Group",     payer: "BCBS — TX", state: "TX", status: "info_requested", sub: "License copy",          idle: 7,  updated: "5d ago",  assignee: "M. Alvarez", recred: "2026-10-30", cycle: 1 },
  { id: "ENR-104318", provider: "Dr. Naima Brooks",     client: "Hudson Family Medicine",    payer: "UHC",       state: "NY", status: "info_requested", sub: "W-9 form",              idle: 7,  updated: "5d ago",  assignee: "S. Park",    recred: "2026-09-01", cycle: 1 },
  { id: "ENR-104282", provider: "Dr. Imran Khan",       client: "Khan Internal Medicine",    payer: "BCBS — TX", state: "TX", status: "approved",       sub: "Eff. 2026-06-01",       idle: 22, updated: "1w ago",  assignee: "M. Alvarez", recred: "2027-06-01", cycle: 1 },
  { id: "ENR-104247", provider: "Dr. Imran Khan",       client: "Khan Internal Medicine",    payer: "UHC",       state: "TX", status: "info_requested", sub: "Tax ID confirmation",   idle: 5,  updated: "5d ago",  assignee: "S. Park",    recred: "2026-12-18", cycle: 1 },
  { id: "ENR-104221", provider: "Dr. Sana Khan",        client: "Khan Internal Medicine",    payer: "Aetna",     state: "TX", status: "prep",           sub: "Documents collection",  idle: 2,  updated: "3d ago",  assignee: "M. Alvarez", recred: "2027-04-10", cycle: 1 },
  { id: "ENR-104198", provider: "Dr. Sana Khan",        client: "Khan Internal Medicine",    payer: "BCBS — TX", state: "TX", status: "submitted",      sub: "Awaiting ack.",         idle: 9,  updated: "4d ago",  assignee: "M. Alvarez", recred: "2027-05-02", cycle: 1 },
  { id: "ENR-104172", provider: "Dr. Imran Khan",       client: "Khan Internal Medicine",    payer: "Cigna",     state: "TX", status: "effective",      sub: "—",                     idle: 47, updated: "6d ago",  assignee: "S. Park",    recred: "2027-04-01", cycle: 2 },
  { id: "ENR-104144", provider: "Dr. Sana Khan",        client: "Khan Internal Medicine",    payer: "Humana",    state: "TX", status: "intake",         sub: "Welcome questionnaire", idle: 8,  updated: "8d ago",  assignee: "M. Alvarez", recred: "—",          cycle: 1 },
  { id: "ENR-104102", provider: "Dr. Imran Khan",       client: "Khan Internal Medicine",    payer: "Humana",    state: "TX", status: "in_review",      sub: "Initial review",        idle: 16, updated: "12d ago", assignee: "S. Park",    recred: "2026-11-22", cycle: 2 },
  { id: "ENR-104088", provider: "Dr. Felipe Cruz",      client: "Pacific Coast Surgery",     payer: "Aetna",     state: "CA", status: "denied",         sub: "Adverse — appealable",  idle: 28, updated: "2w ago",  assignee: "M. Alvarez", recred: "—",          cycle: 1 },
  { id: "ENR-104052", provider: "Dr. Helena Wu",        client: "Northstar Pediatrics",      payer: "Aetna",     state: "NY", status: "submitted",      sub: "Acknowledgment pending", idle: 4,  updated: "4d ago",  assignee: "S. Park",    recred: "2027-04-18", cycle: 1 },
  { id: "ENR-104021", provider: "Dr. Marcus Ali",       client: "Bayview Medical Group",     payer: "Humana",    state: "TX", status: "intake",         sub: "Welcome questionnaire", idle: 1,  updated: "1d ago",  assignee: "M. Alvarez", recred: "—",          cycle: 1 },
  { id: "ENR-103998", provider: "Dr. Eric Bowen",       client: "Anthem-Linked Allergy",     payer: "BCBS — CA", state: "CA", status: "withdrawn",      sub: "Provider exit",         idle: 60, updated: "1mo ago", assignee: "M. Alvarez", recred: "—",          cycle: 1 },
  { id: "ENR-103971", provider: "Dr. Naomi Field",      client: "Northstar Pediatrics",      payer: "Cigna",     state: "NY", status: "closed",         sub: "Effective expired",     idle: 42, updated: "3w ago",  assignee: "S. Park",    recred: "—",          cycle: 1 },
  { id: "ENR-103942", provider: "Dr. Henry Adkins",     client: "Hudson Family Medicine",    payer: "Anthem",    state: "NY", status: "approved",       sub: "Awaiting eff. date",    idle: 11, updated: "1w ago",  assignee: "M. Alvarez", recred: "2027-03-30", cycle: 1 },
];

const statusStyles = {
  intake:         { bg: "var(--lightgrey)", text: "var(--charcoal)",     dot: "var(--grey)"   },
  prep:           { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--aqua)"   },
  submitted:      { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--teal)"   },
  in_review:      { bg: "var(--teal-08)",   text: "var(--navy)",         dot: "var(--teal)"   },
  info_requested: { bg: "var(--amber-08)",  text: "var(--charcoal)",     dot: "var(--amber)"  },
  approved:       { bg: "var(--green-08)",  text: "#1B5E20",             dot: "var(--green)"  },
  denied:         { bg: "var(--red-08)",    text: "var(--red)",          dot: "var(--red)"    },
  effective:      { bg: "var(--green-08)",  text: "#1B5E20",             dot: "var(--green)"  },
  closed:         { bg: "var(--lightgrey)", text: "rgba(14,20,60,0.55)", dot: "var(--grey)"   },
  withdrawn:      { bg: "var(--lightgrey)", text: "rgba(14,20,60,0.55)", dot: "var(--grey)"   },
};
const statusLabel = (k) => k.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase());

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, className = "" }) => {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" {...s}/><rect x="14" y="3" width="7" height="5" {...s}/><rect x="14" y="12" width="7" height="9" {...s}/><rect x="3" y="16" width="7" height="5" {...s}/></>,
    clients: <><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" {...s}/><circle cx="10" cy="7" r="4" {...s}/><path d="M19 8a3 3 0 1 0-3-3" {...s}/></>,
    providers: <><path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...s}/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/></>,
    enrollments: <><rect x="3" y="4" width="18" height="16" rx="1.5" {...s}/><path d="M3 9h18M8 4v16" {...s}/></>,
    recreds: <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 7v5l3 2" {...s}/></>,
    payers: <><rect x="3" y="6" width="18" height="13" rx="1.5" {...s}/><path d="M3 10h18M7 15h3" {...s}/></>,
    documents: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...s}/><path d="M14 3v6h6M8 13h8M8 17h6" {...s}/></>,
    audit: <><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" {...s}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...s}/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...s}/></>,
    comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/></>,
    search: <><circle cx="11" cy="11" r="7" {...s}/><path d="m20 20-3.5-3.5" {...s}/></>,
    chevron_down: <><path d="m6 9 6 6 6-6" {...s}/></>,
    chevron_up: <><path d="m18 15-6-6-6 6" {...s}/></>,
    chevron_right: <><path d="m9 18 6-6-6-6" {...s}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...s}/></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" {...s}/></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" {...s}/></>,
    sort: <><path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" {...s}/></>,
    x: <><path d="M18 6 6 18M6 6l12 12" {...s}/></>,
    columns: <><rect x="3" y="3" width="7" height="18" rx="1" {...s}/><rect x="14" y="3" width="7" height="18" rx="1" {...s}/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" {...s}/><path d="M17 21v-8H7v8M7 3v5h8" {...s}/></>,
    info: <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 8v4M12 16h.01" {...s}/></>,
    star: <><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" {...s}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{paths[name]}</svg>;
};

const StatusChip = ({ status }) => {
  const st = statusStyles[status];
  return (
    <span className="status-chip" style={{ background: st.bg, color: st.text }}>
      <span className="status-dot" style={{ background: st.dot }}/>
      <span>{statusLabel(status).toUpperCase()}</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shell — TopBar + Sidebar (mirrors Dashboard.html)
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
        <a href="Dashboard.html" style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>Dashboard</a>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>Enrollments</span>
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
    { icon: "dashboard",   label: "Dashboard",     href: "Dashboard.html" },
    { icon: "clients",     label: "Clients" },
    { icon: "providers",   label: "Providers" },
    { icon: "enrollments", label: "Enrollments",   active: true, href: "Enrollments.html" },
    { icon: "recreds",     label: "Recreds Queue", badge: 12 },
    { icon: "payers",      label: "Payers" },
    { icon: "documents",   label: "Documents" },
    { icon: "audit",       label: "Audit Log" },
  ];
  const clientNav = [
    { icon: "dashboard",   label: "Dashboard",   href: "Dashboard.html" },
    { icon: "providers",   label: "Providers" },
    { icon: "enrollments", label: "Enrollments", active: true, href: "Enrollments.html" },
    { icon: "documents",   label: "Documents" },
    { icon: "comments",    label: "Comments" },
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

// ─────────────────────────────────────────────────────────────────────────────
// Saved views (tabs) + filter chips
// ─────────────────────────────────────────────────────────────────────────────
const adminViews = [
  { key: "all_open",     label: "All open",         filter: (r) => !["closed","withdrawn"].includes(r.status), pinned: true, system: true },
  { key: "my_queue",     label: "My queue",         filter: (r) => r.assignee === "M. Alvarez" && !["closed","withdrawn","effective"].includes(r.status), system: true },
  { key: "info_req",     label: "Info requested",   filter: (r) => r.status === "info_requested", system: true },
  { key: "stuck",        label: "Stuck > 7 days",   filter: (r) => r.idle > 7 && !["effective","closed","withdrawn"].includes(r.status), system: true },
  { key: "recreds",      label: "Recreds · 60 days",filter: (r) => r.recred !== "—" && (new Date(r.recred) - new Date("2026-05-08")) / 86400000 <= 60 && (new Date(r.recred) - new Date("2026-05-08")) / 86400000 >= 0 },
  { key: "denied",       label: "Denied",           filter: (r) => r.status === "denied" },
  { key: "all",          label: "All enrollments",  filter: () => true },
];
const clientViews = [
  { key: "all_open",     label: "All open",        filter: (r) => !["closed","withdrawn"].includes(r.status), pinned: true, system: true },
  { key: "info_req",     label: "Needs my action", filter: (r) => r.status === "info_requested", system: true },
  { key: "approved",     label: "Recently approved", filter: (r) => ["approved","effective"].includes(r.status) },
  { key: "all",          label: "All",             filter: () => true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Filter bar
// ─────────────────────────────────────────────────────────────────────────────
const FilterChip = ({ label, value, onClear, icon = "filter" }) => (
  <div className="filter-chip">
    <span style={{ color: "rgba(14,20,60,0.55)", fontWeight: 500 }}>{label}:</span>
    <span style={{ color: "var(--charcoal)", fontWeight: 500 }}>{value}</span>
    <button onClick={onClear} aria-label={`Clear ${label}`}><Icon name="x" size={11}/></button>
  </div>
);

const Dropdown = ({ label, options, value, onChange, icon = "chevron_down" }) => {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <div className="dd-wrap">
      <button className={`dd-trigger ${value ? "is-set" : ""}`} onClick={() => setOpen(!open)}>
        <span style={{ color: "rgba(14,20,60,0.55)", fontWeight: 500 }}>{label}</span>
        {current && <><span style={{ color: "rgba(14,20,60,0.3)" }}>·</span><span style={{ fontWeight: 600, color: "var(--navy)" }}>{current.label}</span></>}
        <Icon name={icon} size={12}/>
      </button>
      {open && (
        <>
          <div className="dd-overlay" onClick={() => setOpen(false)}/>
          <div className="dd-menu">
            <button className="dd-item" onClick={() => { onChange(null); setOpen(false); }}>
              <span style={{ color: "rgba(14,20,60,0.55)" }}>Any {label.toLowerCase()}</span>
            </button>
            <div className="dd-sep"/>
            {options.map(o => (
              <button key={o.value} className={`dd-item ${value === o.value ? "is-active" : ""}`} onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.swatch && <span className="dd-swatch" style={{ background: o.swatch }}/>}
                <span>{o.label}</span>
                {o.count != null && <span className="dd-count">{o.count}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const viewMode = t.viewMode || "admin";
  const density = t.density || "comfortable";

  // RLS: client view scoped to Khan Internal Medicine
  const scoped = useMemo(() => viewMode === "admin" ? allRows : allRows.filter(r => r.client === "Khan Internal Medicine"), [viewMode]);

  const views = viewMode === "admin" ? adminViews : clientViews;
  const [activeView, setActiveView] = useState(views[0].key);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [payerFilter, setPayerFilter] = useState(null);
  const [stateFilter, setStateFilter] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const [sort, setSort] = useState({ col: "updated", dir: "desc" });
  const [selected, setSelected] = useState(new Set());

  // When viewMode flips, reset
  React.useEffect(() => { setActiveView(views[0].key); setSelected(new Set()); }, [viewMode]);

  const view = views.find(v => v.key === activeView) || views[0];

  // Apply pipeline
  const filtered = useMemo(() => {
    let rows = scoped.filter(view.filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.provider.toLowerCase().includes(q) ||
        r.payer.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.client.toLowerCase().includes(q)
      );
    }
    if (statusFilter)   rows = rows.filter(r => r.status === statusFilter);
    if (payerFilter)    rows = rows.filter(r => r.payer === payerFilter);
    if (stateFilter)    rows = rows.filter(r => r.state === stateFilter);
    if (assigneeFilter) rows = rows.filter(r => r.assignee === assigneeFilter);

    // Sort
    const dir = sort.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      if (sort.col === "idle") return (va - vb) * dir;
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return 0;
    });
    return rows;
  }, [scoped, view, search, statusFilter, payerFilter, stateFilter, assigneeFilter, sort]);

  const counts = useMemo(() => {
    const m = {};
    views.forEach(v => { m[v.key] = scoped.filter(v.filter).length; });
    return m;
  }, [scoped, views]);

  const toggleSel = (id) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const setSortCol = (col) => {
    if (sort.col === col) setSort({ col, dir: sort.dir === "asc" ? "desc" : "asc" });
    else setSort({ col, dir: "desc" });
  };

  const payerOpts = [...new Set(scoped.map(r => r.payer))].sort().map(p => ({ value: p, label: p }));
  const stateOpts = [...new Set(scoped.map(r => r.state))].sort().map(p => ({ value: p, label: p }));
  const assigneeOpts = [...new Set(scoped.map(r => r.assignee))].sort().map(p => ({ value: p, label: p }));
  const statusOpts = ["intake","prep","submitted","in_review","info_requested","approved","denied","effective","closed","withdrawn"]
    .map(s => ({ value: s, label: statusLabel(s), swatch: statusStyles[s].dot }));

  const activeFilters = [statusFilter, payerFilter, stateFilter, assigneeFilter, search].filter(Boolean).length;
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <>
      <TopBar viewMode={viewMode}/>
      <div className="app-body">
        <Sidebar viewMode={viewMode}/>
        <main className="main">
          {/* Page header */}
          <div className="page-header">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="page-title">Enrollments</h1>
                <div className="page-greeting">
                  {viewMode === "admin"
                    ? `${scoped.length} enrollments across all clients · RLS scoped to your role`
                    : `${scoped.length} enrollments for Khan Internal Medicine`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost"><Icon name="download" size={14}/> Export CSV</button>
                <a href="New Enrollment.html" className="btn-primary"><Icon name="plus" size={14}/> New enrollment</a>
              </div>
            </div>
          </div>

          {/* Saved views (tabs) */}
          <div className="saved-views" role="tablist">
            {views.map(v => (
              <button key={v.key} role="tab" aria-selected={activeView === v.key}
                      className={`saved-view ${activeView === v.key ? "is-active" : ""}`}
                      onClick={() => setActiveView(v.key)}>
                {v.pinned && <Icon name="star" size={11} className="saved-view-star"/>}
                <span>{v.label}</span>
                <span className="saved-view-count">{counts[v.key] ?? 0}</span>
              </button>
            ))}
            <button className="saved-view saved-view-add" title="Save current filters as a view">
              <Icon name="plus" size={11}/>
              <span>Save view</span>
            </button>
          </div>

          {/* Filter bar */}
          <div className="filter-bar">
            <div className="search-input">
              <Icon name="search" size={13}/>
              <input
                placeholder={viewMode === "admin" ? "Search by provider, payer, ID, or client…" : "Search by provider or payer…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch("")} className="search-clear" aria-label="Clear search"><Icon name="x" size={11}/></button>}
            </div>

            <div className="filter-bar-right">
              <Dropdown label="Status"  options={statusOpts}   value={statusFilter}   onChange={setStatusFilter}/>
              <Dropdown label="Payer"   options={payerOpts}    value={payerFilter}    onChange={setPayerFilter}/>
              <Dropdown label="State"   options={stateOpts}    value={stateFilter}    onChange={setStateFilter}/>
              {viewMode === "admin" && (
                <Dropdown label="Assignee" options={assigneeOpts} value={assigneeFilter} onChange={setAssigneeFilter}/>
              )}
              <div className="filter-divider"/>
              <button className="btn-ghost btn-icon" title="Customize columns"><Icon name="columns" size={14}/></button>
              <button className={`btn-ghost btn-icon ${density === "compact" ? "is-on" : ""}`}
                      title={`Density: ${density === "comfortable" ? "comfortable" : "compact"}`}
                      onClick={() => setTweak("density", density === "comfortable" ? "compact" : "comfortable")}>
                <Icon name={density === "comfortable" ? "chevron_up" : "chevron_down"} size={14}/>
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilters > 0 && (
            <div className="filter-chips">
              {search && <FilterChip label="Search" value={`"${search}"`} onClear={() => setSearch("")}/>}
              {statusFilter && <FilterChip label="Status" value={statusLabel(statusFilter)} onClear={() => setStatusFilter(null)}/>}
              {payerFilter && <FilterChip label="Payer" value={payerFilter} onClear={() => setPayerFilter(null)}/>}
              {stateFilter && <FilterChip label="State" value={stateFilter} onClear={() => setStateFilter(null)}/>}
              {assigneeFilter && <FilterChip label="Assignee" value={assigneeFilter} onClear={() => setAssigneeFilter(null)}/>}
              <button className="filter-clear-all" onClick={() => { setSearch(""); setStatusFilter(null); setPayerFilter(null); setStateFilter(null); setAssigneeFilter(null); }}>Clear all</button>
            </div>
          )}

          {/* Bulk action bar — appears when rows selected */}
          {selected.size > 0 && (
            <div className="bulk-bar">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{selected.size} selected</span>
                <button className="bulk-btn" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === "admin" && <button className="bulk-btn">Reassign…</button>}
                <button className="bulk-btn">Export</button>
                <button className="bulk-btn">Add comment…</button>
                {viewMode === "admin" && <button className="bulk-btn bulk-btn-warn">Mark withdrawn…</button>}
              </div>
            </div>
          )}

          {/* Table */}
          <div className={`table-card density-${density}`}>
            <div className="table-scroll">
              <table className="enr-table">
                <thead>
                  <tr>
                    <th className="th-check">
                      <input type="checkbox" checked={allSelected} onChange={selectAll} aria-label="Select all"/>
                    </th>
                    <SortableTh col="provider" sort={sort} onSort={setSortCol}>Provider</SortableTh>
                    {viewMode === "admin" && <SortableTh col="client" sort={sort} onSort={setSortCol}>Client</SortableTh>}
                    <SortableTh col="payer" sort={sort} onSort={setSortCol}>Payer</SortableTh>
                    <th style={{ width: 56 }}>State</th>
                    <SortableTh col="status" sort={sort} onSort={setSortCol}>Status</SortableTh>
                    <th>Sub-status</th>
                    <SortableTh col="idle" sort={sort} onSort={setSortCol} align="right">Days idle</SortableTh>
                    <SortableTh col="updated" sort={sort} onSort={setSortCol}>Updated</SortableTh>
                    {viewMode === "admin" && <th>Assigned</th>}
                    <th>Recred due</th>
                    <th style={{ width: 32 }}/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={viewMode === "admin" ? 12 : 10}>
                      <div className="empty-state">
                        <Icon name="filter" size={28}/>
                        <div className="empty-title">No enrollments match these filters</div>
                        <div className="empty-sub">Try clearing filters, or switch to a different saved view.</div>
                      </div>
                    </td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className={selected.has(r.id) ? "is-selected" : ""}>
                      <td className="td-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} aria-label={`Select ${r.id}`}/></td>
                      <td>
                        <a href="Enrollment Detail.html" className="cell-provider">
                          <span className="cell-provider-name">{r.provider}</span>
                          <span className="cell-provider-id">{r.id}{r.cycle > 1 && <> · <span style={{ color: "var(--teal)" }}>Cycle {r.cycle}</span></>}</span>
                        </a>
                      </td>
                      {viewMode === "admin" && <td className="cell-muted">{r.client}</td>}
                      <td>{r.payer}</td>
                      <td className="cell-mono">{r.state}</td>
                      <td><StatusChip status={r.status}/></td>
                      <td className="cell-muted">{r.sub}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="days-idle" data-warn={r.idle >= 14 ? "high" : r.idle >= 7 ? "med" : "low"}>{r.idle}d</span>
                      </td>
                      <td className="cell-muted" style={{ fontSize: 12 }}>{r.updated}</td>
                      {viewMode === "admin" && <td className="cell-muted">{r.assignee}</td>}
                      <td className="cell-mono cell-muted" style={{ fontSize: 12 }}>{r.recred}</td>
                      <td className="td-chev"><Icon name="chevron_right" size={14}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / pagination */}
            <div className="table-footer">
              <div className="pagination-info">
                Showing <strong>{filtered.length}</strong> of {scoped.length} enrollments
              </div>
              <div className="pagination-ctrls">
                <button className="page-btn" disabled>‹ Prev</button>
                <span className="page-num is-active">1</span>
                <button className="page-btn">Next ›</button>
              </div>
            </div>
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
        </TweakSection>
        <TweakSection title="Density">
          <TweakRadio
            value={density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <div style={{ fontSize: 11, color: "rgba(14,20,60,0.55)", marginTop: 8, lineHeight: 1.5 }}>
            Compact reduces row padding and font weight; useful when scanning a long stuck-queue.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const SortableTh = ({ col, sort, onSort, align = "left", children }) => {
  const active = sort.col === col;
  return (
    <th onClick={() => onSort(col)} className="th-sortable" style={{ textAlign: align }}>
      <span className="th-inner" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        {children}
        <span className={`th-sort-ind ${active ? "is-active" : ""}`}>
          {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </span>
    </th>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
