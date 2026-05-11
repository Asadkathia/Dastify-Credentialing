/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle */
const { useState, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewMode": "admin",
  "groupBy": "time",
  "showRead": true
}/*EDITMODE-END*/;

// ─── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const s = { fill:"none", stroke:"currentColor", strokeWidth:1.6, strokeLinecap:"round", strokeLinejoin:"round" };
  const p = {
    inbox:    <><path d="M22 12h-6l-2 3h-4l-2-3H2" {...s}/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" {...s}/></>,
    bell:     <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><path d="M14 21a2 2 0 0 1-4 0" {...s}/></>,
    search:   <><circle cx="11" cy="11" r="7" {...s}/><path d="m21 21-4.3-4.3" {...s}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...s}/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...s}/></>,
    dashboard: <><rect x="3" y="3" width="7" height="9" {...s}/><rect x="14" y="3" width="7" height="5" {...s}/><rect x="14" y="12" width="7" height="9" {...s}/><rect x="3" y="16" width="7" height="5" {...s}/></>,
    clients:  <><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" {...s}/><circle cx="10" cy="7" r="4" {...s}/><path d="M19 8a3 3 0 1 0-3-3" {...s}/></>,
    providers:<><path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...s}/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" {...s}/><path d="M16 3v3M14.5 4.5h3" {...s}/></>,
    enrollments:<><rect x="3" y="4" width="18" height="16" rx="1.5" {...s}/><path d="M3 9h18M8 4v16" {...s}/></>,
    recreds:  <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 7v5l3 2" {...s}/></>,
    payers:   <><rect x="3" y="6" width="18" height="13" rx="1.5" {...s}/><path d="M3 10h18M7 15h3" {...s}/></>,
    documents:<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s}/><path d="M14 2v6h6M9 13h6M9 17h6" {...s}/></>,
    comments: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/></>,
    audit:    <><circle cx="6" cy="6" r="2" {...s}/><circle cx="18" cy="18" r="2" {...s}/><path d="M6 8v8a2 2 0 0 0 2 2h8" {...s}/></>,
    info:     <><circle cx="12" cy="12" r="9" {...s}/><path d="M12 8v4M12 16h.01" {...s}/></>,
    check:    <><path d="M5 13l4 4L19 7" {...s}/></>,
    x:        <><path d="M18 6 6 18M6 6l12 12" {...s}/></>,
    arrow:    <><path d="M5 12h14M13 5l7 7-7 7" {...s}/></>,
    snooze:   <><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" {...s}/><path d="M9 8h6l-6 8h6" {...s}/></>,
    archive:  <><rect x="3" y="4" width="18" height="4" {...s}/><path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" {...s}/></>,
    reply:    <><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v3" {...s}/></>,
    chevron:  <><path d="M6 9l6 6 6-6" {...s}/></>,
    filter:   <><path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" {...s}/></>,
    file_pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s}/><path d="M14 2v6h6" {...s}/></>,
    user_plus:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...s}/><circle cx="9" cy="7" r="4" {...s}/><path d="M19 8v6M22 11h-6" {...s}/></>,
    warning:  <><path d="M12 3 2 21h20L12 3z" {...s}/><path d="M12 10v5M12 18h.01" {...s}/></>,
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" {...s}/></>,
    refresh:  <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" {...s}/><path d="M21 3v5h-5" {...s}/></>,
    open:     <><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" {...s}/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{p[name]}</svg>;
};

// ─── Data ───────────────────────────────────────────────────────────────────
const items = [
  {
    id: "n1", type: "info_request", unread: true, status: "open",
    actor: "Aetna · Credentialing", actorInitials: "AE", actorKind: "payer",
    enrollment: "ENR-104822", payer: "Aetna", state: "TX",
    headline: "Aetna requested 3 documents on Cycle 2",
    summary: "Malpractice COI (current), DEA registration copy, and Specialty Board recertification.",
    when: "2h", whenAbs: "2026-05-08 12:14 UTC", group: "today",
    needsAction: true,
    body: {
      kind: "info_request",
      requested: [
        { name: "Malpractice Certificate of Insurance", state: "missing", due: "May 22" },
        { name: "DEA Registration (current)", state: "uploaded", due: "May 22" },
        { name: "Specialty Board Recertification", state: "missing", due: "May 22" },
      ],
      ack: "Aetna acknowledged receipt 04/28; reviewer cited file age >180d.",
      reviewer: "K. Tanaka · Aetna Medical Affairs",
    },
  },
  {
    id: "n2", type: "approval", unread: true, status: "open",
    actor: "BCBS Texas", actorInitials: "BC", actorKind: "payer",
    enrollment: "ENR-104810", payer: "BCBS TX", state: "TX",
    headline: "Approval received — effective Jun 1, 2026",
    summary: "Cycle 1 closed. Effective letter attached. Next recred opens May 1, 2027.",
    when: "5h", whenAbs: "2026-05-08 09:42 UTC", group: "today",
    needsAction: true,
    body: {
      kind: "approval",
      effective: "2026-06-01",
      nextRecred: "2027-05-01",
      welcome: "Provider welcome packet auto-attached. Will go out via your client.",
      attachment: { name: "BCBS-TX_Approval_ENR-104810.pdf", size: "248 KB", pages: 3 },
    },
  },
  {
    id: "n3", type: "comment", unread: true, status: "open",
    actor: "Maya Alvarez", actorInitials: "MA", actorKind: "user",
    enrollment: "ENR-104822", payer: "Aetna", state: "TX", isMention: true,
    headline: "Mentioned you on ENR-104822",
    summary: "@you – heads up, the COI on file expired last week. Want me to chase the carrier or do you have it?",
    when: "6h", whenAbs: "2026-05-08 08:30 UTC", group: "today",
    body: {
      kind: "comment",
      text: "@you – heads up, the COI on file expired last week. Want me to chase the carrier or do you have it? I'd rather not push the response date and risk an info_requested → withdrawn cascade.",
      thread: 3,
    },
  },
  {
    id: "n4", type: "denial", unread: false, status: "open",
    actor: "Cigna", actorInitials: "CI", actorKind: "payer",
    enrollment: "ENR-104791", payer: "Cigna", state: "AZ",
    headline: "Denial — appealable",
    summary: "Reason: \"Specialty board cert expired prior to submission window.\" Recommend renewal then re-file in cycle 2.",
    when: "Yesterday", whenAbs: "2026-05-07 15:11 UTC", group: "yesterday",
    needsAction: true,
    body: {
      kind: "denial",
      reason: "Specialty board cert expired prior to submission window.",
      appealable: true,
      appealDeadline: "2026-06-06",
      recommendation: "Renew cert before re-applying. Cycle 2 recommended.",
    },
  },
  {
    id: "n5", type: "recred", unread: false, status: "open",
    actor: "Dastify · System", actorInitials: "D", actorKind: "system",
    enrollment: "ENR-104544", payer: "United HC", state: "FL",
    headline: "Recred window opens in 14 days",
    summary: "Cycle 1 effective 2025-06-15 · Recred window opens 2026-05-22.",
    when: "Yesterday", whenAbs: "2026-05-07 06:00 UTC", group: "yesterday",
    body: {
      kind: "recred",
      currentEffective: "2025-06-15",
      windowOpens: "2026-05-22",
      windowCloses: "2026-08-15",
      slaDays: 60,
    },
  },
  {
    id: "n6", type: "approval", unread: false, status: "done",
    actor: "Humana", actorInitials: "HU", actorKind: "payer",
    enrollment: "ENR-104688", payer: "Humana", state: "TX",
    headline: "Effective letter received",
    summary: "Effective Apr 1. Next recred 2027-03-01.",
    when: "Mon", whenAbs: "2026-05-04 11:02 UTC", group: "this_week",
    body: {
      kind: "approval", effective: "2026-04-01", nextRecred: "2027-03-01",
      attachment: { name: "Humana_Effective_ENR-104688.pdf", size: "192 KB", pages: 2 },
    },
  },
  {
    id: "n7", type: "system", unread: false, status: "open",
    actor: "Dastify · System", actorInitials: "D", actorKind: "system",
    enrollment: null,
    headline: "Weekly digest — 4 enrollments stuck >7d",
    summary: "ENR-104822 (info req · 9d), ENR-104540 (in_review · 11d), ENR-104522 (in_review · 8d), ENR-104440 (info req · 14d).",
    when: "Mon", whenAbs: "2026-05-04 06:00 UTC", group: "this_week",
    body: { kind: "system", links: ["ENR-104822", "ENR-104540", "ENR-104522", "ENR-104440"] },
  },
  {
    id: "n8", type: "info_request", unread: false, status: "snoozed", snoozedUntil: "Tomorrow",
    actor: "Aetna · Credentialing", actorInitials: "AE", actorKind: "payer",
    enrollment: "ENR-104540", payer: "Aetna", state: "CA",
    headline: "Aetna asked for hospital privileges letter",
    summary: "Snoozed until tomorrow — provider's hospital is sending updated privileges 5/9.",
    when: "Apr 30", whenAbs: "2026-04-30 14:22 UTC", group: "this_week",
    body: {
      kind: "info_request",
      requested: [{ name: "Hospital privileges letter", state: "pending", due: "May 9" }],
      ack: "Provider's hospital admin confirmed letter in flight.",
      reviewer: "L. Park · Aetna",
    },
  },
];

const tabsAdmin = [
  { id: "all",       label: "All",             filter: i => true },
  { id: "mentions",  label: "Mentions",        filter: i => i.isMention, kind: "mentions" },
  { id: "action",    label: "Action required", filter: i => i.needsAction && i.status === "open", kind: "action" },
  { id: "approvals", label: "Approvals",       filter: i => i.type === "approval" },
  { id: "denials",   label: "Denials",         filter: i => i.type === "denial" },
  { id: "recreds",   label: "Recreds",         filter: i => i.type === "recred" },
  { id: "system",    label: "System",          filter: i => i.type === "system" },
];
const tabsClient = [
  { id: "all",       label: "All",             filter: i => true },
  { id: "action",    label: "Needs my action", filter: i => i.needsAction && i.status === "open", kind: "action" },
  { id: "approvals", label: "Approvals",       filter: i => i.type === "approval" },
  { id: "comments",  label: "Comments",        filter: i => i.type === "comment" },
];

// ─── Sidebar nav ────────────────────────────────────────────────────────────
const navAdmin = [
  { icon: "dashboard",   label: "Dashboard",   href: "Dashboard.html" },
  { icon: "inbox",       label: "Inbox",       active: true, badge: 6, badgeKind: "mentions" },
  { icon: "clients",     label: "Clients" },
  { icon: "providers",   label: "Providers" },
  { icon: "enrollments", label: "Enrollments", href: "Enrollments.html" },
  { icon: "recreds",     label: "Recreds Queue", badge: 12 },
  { icon: "payers",      label: "Payers" },
  { icon: "documents",   label: "Documents" },
  { icon: "audit",       label: "Audit Log" },
];
const navClient = [
  { icon: "dashboard",   label: "Dashboard",   href: "Dashboard.html" },
  { icon: "inbox",       label: "Inbox",       active: true, badge: 3, badgeKind: "mentions" },
  { icon: "providers",   label: "Providers" },
  { icon: "enrollments", label: "Enrollments", href: "Enrollments.html" },
  { icon: "documents",   label: "Documents" },
  { icon: "comments",    label: "Comments" },
];

// ─── Bits ───────────────────────────────────────────────────────────────────
const TopBar = () => (
  <div className="topbar">
    <div className="brand">
      <span className="brand-mark">D</span>
      <span className="brand-name">Dastify</span>
      <span className="brand-sep">/</span>
      <span className="brand-page">Inbox</span>
    </div>
    <div className="topbar-search">
      <Icon name="search" size={14}/>
      <span>Search providers, enrollments, payers…</span>
      <kbd>⌘K</kbd>
    </div>
    <div className="topbar-actions">
      <button className="topbar-icon-btn is-active" aria-label="Inbox">
        <Icon name="bell" size={16}/>
        <span className="ping"/>
      </button>
      <button className="topbar-icon-btn"><Icon name="settings" size={16}/></button>
      <div className="topbar-user">
        <div className="avatar">MA</div>
      </div>
    </div>
  </div>
);

const Sidebar = ({ viewMode }) => {
  const nav = viewMode === "admin" ? navAdmin : navClient;
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">{viewMode === "admin" ? "Workspace" : "Khan Internal Medicine"}</div>
        {nav.map(item => (
          <a key={item.label} className={`sidebar-item ${item.active ? "is-active" : ""}`} href={item.href || "#"}>
            <Icon name={item.icon} size={16}/>
            <span>{item.label}</span>
            {item.badge != null && <span className={`sidebar-badge ${item.badgeKind === "mentions" ? "is-mentions" : ""}`}>{item.badge}</span>}
          </a>
        ))}
      </div>
      <div className="sidebar-divider"/>
      <div className="sidebar-section">
        <a className="sidebar-item" href="#"><Icon name="settings" size={16}/><span>Settings</span></a>
      </div>
    </aside>
  );
};

const TypeIcon = ({ type }) => {
  const iconMap = {
    info_request: "warning",
    approval:     "check",
    denial:       "x",
    comment:      "comments",
    recred:       "refresh",
    system:       "sparkles",
    mention:      "comments",
  };
  return (
    <div className={`type-icon type-${type}`}>
      <Icon name={iconMap[type]} size={16}/>
    </div>
  );
};

const Row = ({ item, selected, onSelect, checked, onCheck, onAction }) => {
  const klass = [
    "inbox-row",
    selected && "is-selected",
    item.unread && "is-unread",
    item.status === "snoozed" && "is-snoozed",
    item.status === "done" && "is-done",
  ].filter(Boolean).join(" ");

  return (
    <div className={klass} onClick={onSelect}>
      <div className="ir-checkbox-wrap" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onCheck}/>
      </div>
      <div className="ir-icon-wrap">
        {item.unread && <span className="ir-unread-dot"/>}
        <TypeIcon type={item.isMention ? "mention" : item.type}/>
      </div>
      <div className="ir-body">
        <div className="ir-meta-line">
          <span className="ir-actor">{item.actor}</span>
          {item.status === "snoozed" && <span style={{ color: "var(--amber)" }}>· snoozed until {item.snoozedUntil}</span>}
          {item.status === "done" && <span style={{ color: "var(--green)" }}>· done</span>}
        </div>
        <p className="ir-headline">{item.headline}</p>
        <div className="ir-tags">
          {item.enrollment && <span className="ir-tag ir-tag-enr">{item.enrollment}</span>}
          {item.payer && <span className="ir-tag ir-tag-payer">{item.payer} · {item.state}</span>}
          {item.needsAction && item.status === "open" && <span className="ir-tag ir-tag-action">Action required</span>}
        </div>
      </div>
      <div className="ir-time-col">
        <span>{item.when}</span>
        <div className="ir-row-actions" onClick={e => e.stopPropagation()}>
          <button onClick={() => onAction(item.id, "snooze")} title="Snooze"><Icon name="snooze" size={13}/></button>
          <button onClick={() => onAction(item.id, "done")} title="Mark done"><Icon name="check" size={13}/></button>
          <button onClick={() => onAction(item.id, "archive")} title="Archive"><Icon name="archive" size={13}/></button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail pane bodies ─────────────────────────────────────────────────────
const DetailInfoRequest = ({ item }) => (
  <>
    <div className="dp-section">
      <h4 className="dp-section-h">Documents requested</h4>
      <div className="checklist">
        {item.body.requested.map((d, i) => (
          <div key={i} className={`checklist-item ${d.state === "uploaded" ? "is-done" : ""}`}>
            <span className="ci-check">
              {d.state === "uploaded" && <Icon name="check" size={11}/>}
            </span>
            <span className="ci-name">{d.name}</span>
            <span className="ci-meta">
              {d.state === "uploaded" ? "uploaded" : d.state === "pending" ? "pending" : `due ${d.due}`}
            </span>
          </div>
        ))}
      </div>
    </div>
    <div className="dp-section">
      <h4 className="dp-section-h">Reviewer note</h4>
      <div className="dp-prose">
        <div className="quote">{item.body.ack}</div>
        <p style={{ fontSize: 12, color: "rgba(14,20,60,0.55)", margin: 0 }}>
          — {item.body.reviewer}
        </p>
      </div>
    </div>
  </>
);

const DetailApproval = ({ item }) => (
  <>
    <div className="dp-section">
      <h4 className="dp-section-h">Effective dates</h4>
      <dl style={{ margin: 0 }}>
        <div className="audit-line"><dt>Effective</dt><dd><strong style={{ color: "var(--green)" }}>{item.body.effective}</strong></dd></div>
        <div className="audit-line"><dt>Next recred</dt><dd>{item.body.nextRecred} <span style={{ color: "rgba(14,20,60,0.55)" }}>· 12mo cadence</span></dd></div>
      </dl>
    </div>
    {item.body.attachment && (
      <div className="dp-section">
        <h4 className="dp-section-h">Approval letter</h4>
        <div className="attach-card">
          <div className="attach-card-thumb"><Icon name="file_pdf" size={20}/></div>
          <div className="attach-card-l">
            <div className="attach-card-name">{item.body.attachment.name}</div>
            <div className="attach-card-meta">{item.body.attachment.size} · {item.body.attachment.pages} pages</div>
          </div>
          <button className="btn-ghost-sm"><Icon name="open" size={12}/>Open</button>
        </div>
      </div>
    )}
    {item.body.welcome && (
      <div className="dp-section">
        <h4 className="dp-section-h">Welcome packet</h4>
        <div className="dp-prose">{item.body.welcome}</div>
      </div>
    )}
  </>
);

const DetailDenial = ({ item }) => (
  <>
    <div className="dp-section">
      <h4 className="dp-section-h">Denial reason</h4>
      <div className="dp-prose">
        <div className="quote" style={{ borderColor: "var(--red)", background: "var(--red-08)" }}>
          {item.body.reason}
        </div>
      </div>
    </div>
    {item.body.appealable && (
      <div className="dp-section">
        <h4 className="dp-section-h">Appeal</h4>
        <dl style={{ margin: 0 }}>
          <div className="audit-line"><dt>Status</dt><dd><strong style={{ color: "var(--amber)" }}>Appealable</strong></dd></div>
          <div className="audit-line"><dt>Deadline</dt><dd>{item.body.appealDeadline} <span style={{ color: "rgba(14,20,60,0.55)" }}>· 30 days from denial</span></dd></div>
        </dl>
      </div>
    )}
    <div className="dp-section">
      <h4 className="dp-section-h">Recommendation</h4>
      <div className="dp-prose">{item.body.recommendation}</div>
    </div>
  </>
);

const DetailComment = ({ item }) => (
  <div className="dp-section">
    <h4 className="dp-section-h">Comment thread · {item.body.thread} replies</h4>
    <div className="dp-prose">
      <div className="quote">{item.body.text}</div>
    </div>
  </div>
);

const DetailRecred = ({ item }) => (
  <div className="dp-section">
    <h4 className="dp-section-h">Recred window</h4>
    <dl style={{ margin: 0 }}>
      <div className="audit-line"><dt>Current eff.</dt><dd>{item.body.currentEffective}</dd></div>
      <div className="audit-line"><dt>Window opens</dt><dd><strong>{item.body.windowOpens}</strong></dd></div>
      <div className="audit-line"><dt>Window closes</dt><dd>{item.body.windowCloses}</dd></div>
      <div className="audit-line"><dt>SLA</dt><dd>Submit within {item.body.slaDays} days of opening</dd></div>
    </dl>
  </div>
);

const DetailSystem = ({ item }) => (
  <div className="dp-section">
    <h4 className="dp-section-h">Stuck enrollments</h4>
    <div className="dp-prose">
      <p>{item.summary}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {item.body.links.map(l => (
          <a key={l} href="#" style={{ color: "var(--teal)", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 500 }}>{l} →</a>
        ))}
      </div>
    </div>
  </div>
);

const DetailPane = ({ item, onAction }) => {
  if (!item) {
    return (
      <div className="detail-pane">
        <div className="dp-empty">
          <div className="dp-empty-icon"><Icon name="inbox" size={26}/></div>
          <h3 className="dp-empty-h">Pick something to read</h3>
          <p className="dp-empty-p">Mentions, approvals, denials, info requests, and recred reminders — all in one stream. RLS-scoped per tenant.</p>
        </div>
      </div>
    );
  }

  const typeLabel = {
    info_request: "Info request",
    approval: "Approval",
    denial: "Denial",
    comment: "Comment",
    recred: "Recred reminder",
    system: "System",
  }[item.type];

  const ActionsByType = () => {
    if (item.type === "info_request") {
      return (
        <>
          <button className="btn-primary"><Icon name="documents" size={13}/>Open enrollment</button>
          <button className="btn-ghost"><Icon name="reply" size={13}/>Reply to reviewer</button>
        </>
      );
    }
    if (item.type === "approval") {
      return (
        <>
          <button className="btn-primary btn-primary-ok"><Icon name="check" size={13}/>Mark Effective</button>
          <button className="btn-ghost"><Icon name="open" size={13}/>Open enrollment</button>
        </>
      );
    }
    if (item.type === "denial") {
      return (
        <>
          <button className="btn-primary btn-primary-warn"><Icon name="warning" size={13}/>Start appeal</button>
          <button className="btn-ghost"><Icon name="open" size={13}/>Open enrollment</button>
        </>
      );
    }
    if (item.type === "comment") {
      return (
        <>
          <button className="btn-primary"><Icon name="reply" size={13}/>Reply</button>
          <button className="btn-ghost"><Icon name="open" size={13}/>Open enrollment</button>
        </>
      );
    }
    if (item.type === "recred") {
      return (
        <>
          <button className="btn-primary"><Icon name="user_plus" size={13}/>Start recred cycle</button>
          <button className="btn-ghost"><Icon name="snooze" size={13}/>Snooze 7 days</button>
        </>
      );
    }
    return <button className="btn-ghost"><Icon name="open" size={13}/>View details</button>;
  };

  return (
    <div className="detail-pane">
      <div className="dp-head">
        <div className="dp-eyebrow">
          <span className={`dp-eyebrow-tag t-${item.type}`}>{typeLabel}</span>
          <span>·</span>
          <span>{item.whenAbs}</span>
        </div>
        <h2 className="dp-title">{item.headline}</h2>
        <div className="dp-meta">
          <span><strong style={{ color: "var(--charcoal)" }}>{item.actor}</strong></span>
          {item.enrollment && (<><span>·</span><a href="Enrollment Detail.html">{item.enrollment}</a></>)}
          {item.payer && (<><span>·</span><span>{item.payer} · {item.state}</span></>)}
        </div>
      </div>
      <div className="dp-body">
        {item.type === "info_request" && <DetailInfoRequest item={item}/>}
        {item.type === "approval"      && <DetailApproval item={item}/>}
        {item.type === "denial"        && <DetailDenial item={item}/>}
        {item.type === "comment"       && <DetailComment item={item}/>}
        {item.type === "recred"        && <DetailRecred item={item}/>}
        {item.type === "system"        && <DetailSystem item={item}/>}
      </div>
      <div className="dp-actions">
        <ActionsByType/>
        <div className="dp-actions-spacer"/>
        <span className="dp-actions-meta">
          <Icon name="audit" size={11}/>Logged in audit trail
        </span>
        <button className="btn-ghost" onClick={() => onAction(item.id, "snooze")}><Icon name="snooze" size={13}/>Snooze</button>
        <button className="btn-ghost" onClick={() => onAction(item.id, "done")}><Icon name="check" size={13}/>Done</button>
      </div>
    </div>
  );
};

// ─── App ────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const viewMode = t.viewMode || "admin";
  const groupBy = t.groupBy || "time";
  const showRead = t.showRead !== false;

  const [activeTab, setActiveTab] = useState("all");
  const [selectedId, setSelectedId] = useState("n1");
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [statusOverrides, setStatusOverrides] = useState({});

  const tabs = viewMode === "admin" ? tabsAdmin : tabsClient;

  // RLS scope: client only sees their own (Khan Internal Medicine) — n7 system items remain global; comments/mentions filtered to their items
  const scopedItems = useMemo(() => {
    const merged = items.map(it => ({
      ...it,
      ...(statusOverrides[it.id] || {}),
      unread: statusOverrides[it.id]?.status ? false : it.unread,
    }));
    if (viewMode === "client") return merged.filter(i => !["mentions","system"].includes(i.type) || i.type !== "system");
    return merged;
  }, [viewMode, statusOverrides]);

  const tabCounts = useMemo(() => {
    const c = {};
    for (const tab of tabs) {
      c[tab.id] = scopedItems.filter(i => tab.filter(i) && (showRead || i.unread || i.status === "open")).length;
    }
    return c;
  }, [scopedItems, tabs, showRead]);

  const visibleItems = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTab) || tabs[0];
    return scopedItems
      .filter(tab.filter)
      .filter(i => showRead ? true : i.unread || (i.status === "open" && i.needsAction));
  }, [scopedItems, activeTab, tabs, showRead]);

  const groupedItems = useMemo(() => {
    if (groupBy === "time") {
      const groups = { today: [], yesterday: [], this_week: [], earlier: [] };
      for (const it of visibleItems) {
        (groups[it.group] || groups.earlier).push(it);
      }
      return [
        { id: "today",     label: "Today",      items: groups.today },
        { id: "yesterday", label: "Yesterday",  items: groups.yesterday },
        { id: "this_week", label: "This week",  items: groups.this_week },
        { id: "earlier",   label: "Earlier",    items: groups.earlier },
      ].filter(g => g.items.length > 0);
    }
    if (groupBy === "enrollment") {
      const map = {};
      for (const it of visibleItems) {
        const k = it.enrollment || "—";
        (map[k] = map[k] || []).push(it);
      }
      return Object.entries(map).map(([k, v]) => ({ id: k, label: k, items: v }));
    }
    // by type
    const map = {};
    for (const it of visibleItems) {
      (map[it.type] = map[it.type] || []).push(it);
    }
    const labels = { info_request: "Info requests", approval: "Approvals", denial: "Denials", comment: "Comments", recred: "Recreds", system: "System" };
    return Object.entries(map).map(([k, v]) => ({ id: k, label: labels[k] || k, items: v }));
  }, [visibleItems, groupBy]);

  const selected = visibleItems.find(i => i.id === selectedId) || null;

  const handleAction = (id, action) => {
    setStatusOverrides(o => ({
      ...o,
      [id]: action === "snooze"
        ? { status: "snoozed", snoozedUntil: "Tomorrow" }
        : action === "done"
        ? { status: "done" }
        : { status: "archived" },
    }));
    if (action === "archive" && selectedId === id) setSelectedId(null);
  };

  const toggleCheck = (id) => {
    setCheckedIds(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <>
      <TopBar/>
      <div className="app-body">
        <Sidebar viewMode={viewMode}/>

        <div className="inbox-shell">
          <div className="inbox-header">
            <div className="inbox-title-row">
              <div className="inbox-title-l">
                <h1 className="inbox-h1">Inbox</h1>
                <span className="inbox-h-sub">
                  {viewMode === "admin"
                    ? <>Across all clients · <strong>{tabCounts.action || 0}</strong> need action</>
                    : <>Khan Internal Medicine · <strong>{tabCounts.action || 0}</strong> need your action</>}
                </span>
              </div>
              <div className="inbox-actions">
                <button className="btn-ghost"><Icon name="refresh" size={13}/>Refresh</button>
                <button className="btn-ghost"><Icon name="settings" size={13}/>Notification settings</button>
              </div>
            </div>
            <div className="tab-strip">
              {tabs.map(tab => (
                <button key={tab.id}
                        className={`tab ${activeTab === tab.id ? "is-active" : ""} ${tab.kind === "action" ? "is-action" : ""}`}
                        onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                  <span className="tab-count">{tabCounts[tab.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-bar">
            <div className="filter-search">
              <Icon name="search" size={13}/>
              <input placeholder="Search this inbox…"/>
            </div>
            <button className="filter-pill"><span>Source</span><Icon name="chevron" size={12}/></button>
            <button className="filter-pill"><span>Time</span><Icon name="chevron" size={12}/></button>
            <button className={`filter-pill ${!showRead ? "is-on" : ""}`} onClick={() => setTweak("showRead", !showRead)}>
              {!showRead && <Icon name="check" size={12}/>}
              <span>Unread only</span>
            </button>
            <div className="filter-spacer"/>
            <span className="filter-meta">
              Group by: <strong>{groupBy === "time" ? "Time" : groupBy === "enrollment" ? "Enrollment" : "Type"}</strong>
            </span>
          </div>

          {checkedIds.size > 0 && (
            <div className="bulk-bar">
              <div className="bulk-count">
                <button className="bulk-x" onClick={() => setCheckedIds(new Set())}><Icon name="x" size={12}/></button>
                <span>{checkedIds.size} selected</span>
              </div>
              <button className="bulk-action"><Icon name="check" size={12}/>Mark done</button>
              <button className="bulk-action"><Icon name="snooze" size={12}/>Snooze</button>
              <button className="bulk-action"><Icon name="archive" size={12}/>Archive</button>
              {viewMode === "admin" && <button className="bulk-action"><Icon name="user_plus" size={12}/>Assign to…</button>}
            </div>
          )}

          <div className="split">
            <div className="list-pane">
              {groupedItems.length === 0 && (
                <div style={{ padding: 64, textAlign: "center", color: "rgba(14,20,60,0.45)", fontSize: 13 }}>
                  All caught up.
                </div>
              )}
              {groupedItems.map(g => (
                <React.Fragment key={g.id}>
                  <div className="list-group-h">
                    <span>{g.label}</span>
                    <span className="lgh-count">{g.items.length}</span>
                  </div>
                  {g.items.map(it => (
                    <Row key={it.id} item={it}
                         selected={selectedId === it.id}
                         onSelect={() => { setSelectedId(it.id); }}
                         checked={checkedIds.has(it.id)}
                         onCheck={() => toggleCheck(it.id)}
                         onAction={handleAction}/>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <DetailPane item={selected} onAction={handleAction}/>
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="View as">
          <TweakRadio
            value={viewMode}
            onChange={v => setTweak("viewMode", v)}
            options={[
              { value: "admin",  label: "Admin" },
              { value: "client", label: "Client" },
            ]}
          />
          <div style={{ fontSize: 11, color: "rgba(14,20,60,0.55)", marginTop: 8, lineHeight: 1.5 }}>
            Admin sees every tenant. Client view scopes to Khan Internal Medicine and drops Mentions/System tabs.
          </div>
        </TweakSection>
        <TweakSection title="Group by">
          <TweakRadio
            value={groupBy}
            onChange={v => setTweak("groupBy", v)}
            options={[
              { value: "time",       label: "Time" },
              { value: "enrollment", label: "Enrollment" },
              { value: "type",       label: "Type" },
            ]}
          />
        </TweakSection>
        <TweakSection title="Display">
          <TweakToggle
            label="Show read items"
            value={showRead}
            onChange={v => setTweak("showRead", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
