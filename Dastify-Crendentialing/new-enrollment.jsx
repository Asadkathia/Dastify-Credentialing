/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio */
const { useState, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewMode": "admin"
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────
const adminProviders = [
  { id: "PRV-2204", name: "Dr. Imran Khan",      client: "Khan Internal Medicine", npi: "1487209384", specialty: "Internal Medicine", states: ["TX","NM"], existingPayers: ["Aetna","BCBS — TX","UHC","Cigna","Humana"] },
  { id: "PRV-2189", name: "Dr. Sana Khan",       client: "Khan Internal Medicine", npi: "1499217733", specialty: "Pediatrics",        states: ["TX"],      existingPayers: ["Aetna","BCBS — TX","Humana"] },
  { id: "PRV-2155", name: "Dr. Sarah Chen",      client: "Bayview Medical Group",  npi: "1622918844", specialty: "Cardiology",        states: ["TX"],      existingPayers: ["BCBS — TX","Cigna"] },
  { id: "PRV-2147", name: "Dr. Marcus Patel",    client: "Bayview Medical Group",  npi: "1655320192", specialty: "Cardiology",        states: ["CA","NV"], existingPayers: ["UHC"] },
  { id: "PRV-2132", name: "Dr. Lina Rodriguez",  client: "Coastline Cardiology",   npi: "1701192847", specialty: "Cardiology",        states: ["FL"],      existingPayers: ["Humana"] },
  { id: "PRV-2118", name: "Dr. James Okonkwo",   client: "Northstar Pediatrics",   npi: "1722049173", specialty: "Pediatrics",        states: ["NY"],      existingPayers: ["Cigna"] },
];
const clientProviders = adminProviders.filter(p => p.client === "Khan Internal Medicine");

const allPayers = [
  { id: "PAY-AET",   name: "Aetna",       network: "Commercial + Medicare Advantage", avgDays: 52, states: ["TX","NM","CA","NY","FL"] },
  { id: "PAY-BCBSTX", name: "BCBS — TX",  network: "Commercial PPO/HMO",              avgDays: 41, states: ["TX"] },
  { id: "PAY-BCBSCA", name: "BCBS — CA",  network: "Commercial PPO/HMO",              avgDays: 47, states: ["CA"] },
  { id: "PAY-UHC",   name: "UHC",         network: "Commercial + Medicare",           avgDays: 38, states: ["TX","NM","CA","NV","NY","FL"] },
  { id: "PAY-CIG",   name: "Cigna",       network: "Commercial",                      avgDays: 36, states: ["TX","CA","NY","FL"] },
  { id: "PAY-HUM",   name: "Humana",      network: "Medicare Advantage",              avgDays: 44, states: ["TX","FL","NY"] },
  { id: "PAY-ANT",   name: "Anthem",      network: "Commercial",                      avgDays: 49, states: ["CA","NY"] },
  { id: "PAY-MOL",   name: "Molina",      network: "Medicaid + Marketplace",          avgDays: 33, states: ["TX","CA"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Icons (subset)
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
    settings: <><circle cx="12" cy="12" r="3" {...s}/></>,
    comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/></>,
    search: <><circle cx="11" cy="11" r="7" {...s}/><path d="m20 20-3.5-3.5" {...s}/></>,
    chevron_down: <><path d="m6 9 6 6 6-6" {...s}/></>,
    arrow_left: <><path d="M19 12H5M12 19l-7-7 7-7" {...s}/></>,
    arrow_right: <><path d="M5 12h14M13 5l7 7-7 7" {...s}/></>,
    check: <><path d="M5 13l4 4L19 7" {...s}/></>,
    x: <><path d="M18 6 6 18M6 6l12 12" {...s}/></>,
    info: <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 8v4M12 16h.01" {...s}/></>,
    warning: <><path d="M12 3 2 21h20L12 3z" {...s}/><path d="M12 10v5M12 18h.01" {...s}/></>,
    user: <><circle cx="12" cy="8" r="4" {...s}/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" {...s}/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="1.5" {...s}/><path d="M3 10h18M8 3v4M16 3v4" {...s}/></>,
    clock: <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 7v5l3 2" {...s}/></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" {...s}/></>,
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" {...s}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{paths[name]}</svg>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shell — TopBar + Sidebar
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
        <a href="Enrollments.html" style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>Enrollments</a>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 500 }}>New</span>
      </nav>
    </div>
    <div className="flex items-center gap-3">
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
// Stepper
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "provider", label: "Provider",        sub: "Who's being enrolled" },
  { key: "payer",    label: "Payer & State",   sub: "Where they're enrolling" },
  { key: "cycle",    label: "Cycle settings",  sub: "Target dates & recred" },
  { key: "review",   label: "Review & create", sub: "Confirm and submit" },
];

const Stepper = ({ activeIdx }) => (
  <ol className="stepper">
    {STEPS.map((s, i) => {
      const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
      return (
        <li key={s.key} className={`stepper-step is-${state}`}>
          <div className="stepper-bullet">
            {state === "done" ? <Icon name="check" size={13}/> : <span>{i + 1}</span>}
          </div>
          <div className="stepper-text">
            <div className="stepper-label">{s.label}</div>
            <div className="stepper-sub">{s.sub}</div>
          </div>
          {i < STEPS.length - 1 && <div className="stepper-line"/>}
        </li>
      );
    })}
  </ol>
);

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Provider
// ─────────────────────────────────────────────────────────────────────────────
const Step1Provider = ({ providers, selected, onSelect, viewMode }) => {
  const [q, setQ] = useState("");
  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.npi.includes(q) ||
    p.client.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="step-body">
      <div className="step-head">
        <h2>Select a provider</h2>
        <p>{viewMode === "admin"
          ? "Search across all clients. Pick a provider to enroll with a new payer."
          : "Pick a provider in your practice to enroll with a new payer."}</p>
      </div>
      <div className="search-input search-input-lg">
        <Icon name="search" size={14}/>
        <input
          placeholder={viewMode === "admin" ? "Search by name, NPI, or client…" : "Search by name or NPI…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="provider-list">
        {filtered.length === 0 && (
          <div className="empty-block">
            <Icon name="user" size={20}/>
            <span>No providers match "{q}".</span>
            <button className="btn-link">+ Add new provider</button>
          </div>
        )}
        {filtered.map(p => (
          <label key={p.id} className={`provider-card ${selected?.id === p.id ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="provider"
              checked={selected?.id === p.id}
              onChange={() => onSelect(p)}
            />
            <div className="provider-card-avatar">{p.name.split(" ").map(s => s[0]).slice(-2).join("")}</div>
            <div className="provider-card-body">
              <div className="provider-card-row1">
                <span className="provider-card-name">{p.name}</span>
                <span className="provider-card-id">{p.id}</span>
              </div>
              <div className="provider-card-row2">
                <span>{p.specialty}</span>
                <span className="dot-sep"/>
                {viewMode === "admin" && <><span>{p.client}</span><span className="dot-sep"/></>}
                <span>NPI <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{p.npi}</span></span>
                <span className="dot-sep"/>
                <span>Licensed in {p.states.join(", ")}</span>
              </div>
            </div>
            <div className="provider-card-payers">
              <div className="provider-card-payers-label">Existing</div>
              <div className="provider-card-payers-count">{p.existingPayers.length}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Payer & State
// ─────────────────────────────────────────────────────────────────────────────
const Step2Payer = ({ provider, selectedPayer, selectedState, onPayerSelect, onStateSelect }) => {
  const stateChoices = provider?.states || [];
  const availablePayers = useMemo(() => {
    if (!selectedState) return [];
    return allPayers.filter(p =>
      p.states.includes(selectedState) &&
      !provider.existingPayers.includes(p.name)
    );
  }, [provider, selectedState]);

  return (
    <div className="step-body">
      <div className="step-head">
        <h2>Where are they enrolling?</h2>
        <p>Pick a state from {provider?.name}'s licensed states, then choose a payer that's not already enrolled.</p>
      </div>

      {/* Selected provider chip */}
      <div className="ctx-chip">
        <Icon name="user" size={14}/>
        <span><strong>{provider?.name}</strong> · {provider?.specialty} · Licensed in {provider?.states?.join(", ")}</span>
      </div>

      {/* State picker */}
      <div className="form-group">
        <label className="form-label">State <span className="form-req">·</span></label>
        <div className="state-grid">
          {stateChoices.map(st => (
            <button key={st}
                    className={`state-tile ${selectedState === st ? "is-selected" : ""}`}
                    onClick={() => onStateSelect(st)}>
              <span className="state-tile-code">{st}</span>
              <span className="state-tile-meta">{allPayers.filter(p => p.states.includes(st) && !provider.existingPayers.includes(p.name)).length} payers available</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payer list */}
      {selectedState && (
        <div className="form-group">
          <label className="form-label">Payer <span className="form-req">·</span></label>
          {availablePayers.length === 0 ? (
            <div className="empty-block">
              <Icon name="info" size={20}/>
              <span>{provider.name} is already enrolled with every available payer in {selectedState}.</span>
            </div>
          ) : (
            <div className="payer-list">
              {availablePayers.map(p => (
                <label key={p.id} className={`payer-card ${selectedPayer?.id === p.id ? "is-selected" : ""}`}>
                  <input
                    type="radio" name="payer"
                    checked={selectedPayer?.id === p.id}
                    onChange={() => onPayerSelect(p)}
                  />
                  <div className="payer-card-body">
                    <div className="payer-card-name">{p.name}</div>
                    <div className="payer-card-meta">{p.network}</div>
                  </div>
                  <div className="payer-card-stat">
                    <div className="payer-card-stat-num">~{p.avgDays}<span>d</span></div>
                    <div className="payer-card-stat-label">avg time-to-effective</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Cycle settings
// ─────────────────────────────────────────────────────────────────────────────
const Step3Cycle = ({ payer, settings, onChange }) => {
  const today = new Date("2026-05-08");
  const targetEff = settings.targetEff || (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (payer?.avgDays || 45) + 14);
    return d.toISOString().slice(0, 10);
  })();
  const recredCadence = settings.recredCadence || "12mo";
  const expedite = settings.expedite || false;
  const assignee = settings.assignee || "M. Alvarez";

  const recredDate = (() => {
    const d = new Date(targetEff);
    const m = recredCadence === "24mo" ? 24 : recredCadence === "36mo" ? 36 : 12;
    d.setMonth(d.getMonth() + m);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="step-body">
      <div className="step-head">
        <h2>Cycle settings</h2>
        <p>Target effective date and recred cadence drive the timeline. You can adjust these later from the enrollment.</p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="targetEff">Target effective date</label>
        <input id="targetEff" type="date" className="form-input"
               value={targetEff} onChange={(e) => onChange({ ...settings, targetEff: e.target.value })}/>
        <div className="form-hint">
          <Icon name="info" size={11}/>
          <span>Default is today + {payer?.avgDays}d (avg time-to-effective for {payer?.name}) + 14d buffer.</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Recred cadence</label>
        <div className="seg-control">
          {[
            { v: "12mo", l: "12 months",  hint: "Standard" },
            { v: "24mo", l: "24 months",  hint: "Extended" },
            { v: "36mo", l: "36 months",  hint: "TX/CA only" },
          ].map(o => (
            <button key={o.v}
                    className={`seg-btn ${recredCadence === o.v ? "is-active" : ""}`}
                    onClick={() => onChange({ ...settings, recredCadence: o.v })}>
              <span className="seg-btn-l">{o.l}</span>
              <span className="seg-btn-hint">{o.hint}</span>
            </button>
          ))}
        </div>
        <div className="form-hint">
          <Icon name="calendar" size={11}/>
          <span>Recred window opens around <strong style={{ color: "var(--charcoal)" }}>{recredDate}</strong>.</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Assigned to</label>
        <div className="seg-control">
          {["M. Alvarez", "S. Park", "Auto-assign"].map(a => (
            <button key={a}
                    className={`seg-btn ${assignee === a ? "is-active" : ""}`}
                    onClick={() => onChange({ ...settings, assignee: a })}>
              <span className="seg-btn-l">{a}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-toggle">
          <input type="checkbox" checked={expedite} onChange={(e) => onChange({ ...settings, expedite: e.target.checked })}/>
          <div>
            <div className="form-toggle-l">
              <Icon name="bolt" size={13} className="form-toggle-icon"/>
              <span>Expedite this cycle</span>
            </div>
            <div className="form-toggle-sub">Flags the enrollment for SLA tracking and surfaces it on the team's stuck-queue at 5 days idle instead of 7. Adds a 10% surcharge.</div>
          </div>
        </label>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Review
// ─────────────────────────────────────────────────────────────────────────────
const Step4Review = ({ provider, payer, state, settings }) => (
  <div className="step-body">
    <div className="step-head">
      <h2>Review & create</h2>
      <p>Confirm the details. Creating this enrollment will start it in <strong>Intake</strong>, notify the assignee, and queue an automated CAQH refresh.</p>
    </div>

    <div className="review-grid">
      <ReviewBlock title="Provider">
        <div className="review-row"><span>Name</span><strong>{provider.name}</strong></div>
        <div className="review-row"><span>Specialty</span><strong>{provider.specialty}</strong></div>
        <div className="review-row"><span>NPI</span><strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{provider.npi}</strong></div>
        <div className="review-row"><span>Client</span><strong>{provider.client}</strong></div>
      </ReviewBlock>

      <ReviewBlock title="Enrollment scope">
        <div className="review-row"><span>Payer</span><strong>{payer.name}</strong></div>
        <div className="review-row"><span>Network</span><strong>{payer.network}</strong></div>
        <div className="review-row"><span>State</span><strong>{state}</strong></div>
        <div className="review-row"><span>Cycle</span><strong>1</strong></div>
      </ReviewBlock>

      <ReviewBlock title="Cycle settings">
        <div className="review-row"><span>Target effective</span><strong>{settings.targetEff}</strong></div>
        <div className="review-row"><span>Recred cadence</span><strong>{settings.recredCadence === "12mo" ? "12 months" : settings.recredCadence === "24mo" ? "24 months" : "36 months"}</strong></div>
        <div className="review-row"><span>Assigned to</span><strong>{settings.assignee}</strong></div>
        <div className="review-row"><span>Expedite</span><strong>{settings.expedite ? "Yes (10% surcharge)" : "No"}</strong></div>
      </ReviewBlock>

      <ReviewBlock title="What happens next" tone="info">
        <ol className="next-steps">
          <li><span className="next-num">1</span><span><strong>Intake</strong> — assignee receives the enrollment and runs the welcome questionnaire.</span></li>
          <li><span className="next-num">2</span><span><strong>Prep</strong> — CAQH attestation refreshed; document checklist generated against {payer.name}'s requirements.</span></li>
          <li><span className="next-num">3</span><span><strong>Submit</strong> — application packaged and sent to {payer.name}.</span></li>
          <li><span className="next-num">4</span><span><strong>In review</strong> — track progress, respond to info requests as they come in.</span></li>
        </ol>
      </ReviewBlock>
    </div>

    <div className="review-warning">
      <Icon name="warning" size={14}/>
      <span><strong>This is a billable action.</strong> A new enrollment cycle will appear on this client's next invoice. The provider and assignee will be notified by email.</span>
    </div>
  </div>
);

const ReviewBlock = ({ title, tone, children }) => (
  <div className={`review-block ${tone === "info" ? "review-block-info" : ""}`}>
    <div className="review-block-title">{title}</div>
    <div className="review-block-body">{children}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Created confirmation
// ─────────────────────────────────────────────────────────────────────────────
const CreatedScreen = ({ provider, payer, state, settings, onAnother }) => {
  const id = "ENR-104843";
  return (
    <div className="created-card">
      <div className="created-icon">
        <Icon name="check" size={40}/>
      </div>
      <h2 className="created-title">Enrollment created</h2>
      <div className="created-id">{id}</div>
      <div className="created-summary">
        {provider.name} · {payer.name} · {state} · Cycle 1
      </div>
      <div className="created-status">
        <span className="status-chip" style={{ background: "var(--lightgrey)", color: "var(--charcoal)" }}>
          <span className="status-dot" style={{ background: "var(--grey)" }}/>
          <span>INTAKE</span>
        </span>
        <span style={{ color: "rgba(14,20,60,0.55)" }}>· Assigned to {settings.assignee}</span>
      </div>
      <div className="created-actions">
        <a href="Enrollment Detail.html" className="btn-primary"><Icon name="arrow_right" size={14}/>Open enrollment</a>
        <button className="btn-ghost" onClick={onAnother}>+ Create another</button>
        <a href="Enrollments.html" className="btn-ghost">Back to list</a>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const viewMode = t.viewMode || "admin";
  const providers = viewMode === "admin" ? adminProviders : clientProviders;

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(null);
  const [state, setState] = useState(null);
  const [payer, setPayer] = useState(null);
  const [settings, setSettings] = useState({});
  const [created, setCreated] = useState(false);

  const reset = () => {
    setStep(0); setProvider(null); setState(null); setPayer(null); setSettings({}); setCreated(false);
  };

  React.useEffect(() => { reset(); }, [viewMode]);

  const canNext =
    (step === 0 && provider) ||
    (step === 1 && payer && state) ||
    (step === 2) ||
    (step === 3);

  const next = () => {
    if (step === 3) {
      setCreated(true);
      return;
    }
    setStep(step + 1);
  };

  return (
    <>
      <TopBar viewMode={viewMode}/>
      <div className="app-body">
        <Sidebar viewMode={viewMode}/>
        <main className="main">
          {created ? (
            <CreatedScreen provider={provider} payer={payer} state={state} settings={settings} onAnother={reset}/>
          ) : (
            <>
              <div className="page-header">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <div className="eyebrow">New enrollment</div>
                    <h1 className="page-title">Start a new payer enrollment</h1>
                    <div className="page-greeting">Step {step + 1} of {STEPS.length} · {STEPS[step].label}</div>
                  </div>
                  <a href="Enrollments.html" className="btn-ghost"><Icon name="x" size={14}/>Cancel</a>
                </div>
              </div>

              <Stepper activeIdx={step}/>

              <div className="wizard-card">
                {step === 0 && <Step1Provider providers={providers} selected={provider} onSelect={(p) => { setProvider(p); setState(null); setPayer(null); }} viewMode={viewMode}/>}
                {step === 1 && <Step2Payer provider={provider} selectedPayer={payer} selectedState={state} onPayerSelect={setPayer} onStateSelect={(s) => { setState(s); setPayer(null); }}/>}
                {step === 2 && <Step3Cycle payer={payer} settings={settings} onChange={setSettings}/>}
                {step === 3 && <Step4Review provider={provider} payer={payer} state={state} settings={{
                  targetEff: settings.targetEff || (() => { const d = new Date("2026-05-08"); d.setDate(d.getDate() + (payer?.avgDays || 45) + 14); return d.toISOString().slice(0, 10); })(),
                  recredCadence: settings.recredCadence || "12mo",
                  assignee: settings.assignee || "M. Alvarez",
                  expedite: settings.expedite || false,
                }}/>}

                <div className="wizard-foot">
                  <button className="btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                    <Icon name="arrow_left" size={14}/>Back
                  </button>
                  <div className="wizard-foot-meta">
                    {step === 0 && provider && <span>{provider.name}</span>}
                    {step === 1 && state && <span>{provider?.name} · <strong>{state}</strong>{payer && <> · {payer.name}</>}</span>}
                    {step === 2 && <span>{provider?.name} · {payer?.name} · {state}</span>}
                    {step === 3 && <span style={{ color: "var(--green)" }}><Icon name="check" size={12}/> Ready to create</span>}
                  </div>
                  <button className={`btn-primary ${step === 3 ? "btn-primary-go" : ""}`} onClick={next} disabled={!canNext}>
                    {step === 3 ? <>Create enrollment<Icon name="check" size={14}/></> : <>Continue<Icon name="arrow_right" size={14}/></>}
                  </button>
                </div>
              </div>
            </>
          )}
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
            Admin sees all clients' providers in step 1; client sees only Khan Internal Medicine. The "Auto-assign" option is admin-only in production but kept here for visual parity.
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
