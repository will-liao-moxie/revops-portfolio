import { useState, useEffect, useMemo } from "react";

/* ============================================================
   MOXIE REVOPS — PROJECT PORTFOLIO
   Views: Board · Priority Matrix · Sequence · Resourcing
   Presentation-first: viewing is open, editing is password-locked.
   ============================================================ */

const T = {
  bg: "#F4F6F2",
  surface: "#FFFFFF",
  ink: "#1C2521",
  inkSoft: "#5A6660",
  hairline: "#DEE4DC",
  hairlineSoft: "#EAEFE8",
  paper: "#FBFCFA",
  display: "'Bricolage Grotesque', 'Archivo', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
};

const WS = {
  "Marketing Services": { color: "#6A4FD8", soft: "#EFEAFB", code: "MS" },
  "Supplies": { color: "#0E8A74", soft: "#E4F3EF", code: "SUP" },
  "Practice Success": { color: "#C2750F", soft: "#FAF0E0", code: "PS" },
  "Support": { color: "#B5485D", soft: "#F9EAEE", code: "SPT" },
  "Other": { color: "#54616B", soft: "#EBEFF1", code: "OTH" },
};
const WORKSTREAMS = Object.keys(WS);
const STATUSES = ["Scoping", "Proposed", "Approved", "In flight", "Blocked", "Done"];

/* sizing — build load each project places on the teams it touches */
const SIZES = ["S", "M", "L", "XL"];
const SIZE_POINTS = { S: 1, M: 2, L: 3, XL: 4 };
const SIZE_LABEL = { S: "Small", M: "Medium", L: "Large", XL: "X-Large" };
const DEFAULT_CAP = 6;
const TARGETS = ["TBD", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "H2 2026", "2027"];

/* ---------- resourcing taxonomy ---------- */
const ORG = [
  {
    name: "RevOps",
    members: [
      { name: "Pre-Sales", lead: "Addison Huneycutt", match: ["Pre-Sales"] },
      { name: "Post-Sales", lead: "New Hire", match: ["Post-Sales"] },
      { name: "Business Systems", lead: "Will Liao", match: ["Business Systems", "RevOps"] },
    ],
  },
  {
    name: "Contractors",
    members: [
      { name: "HubSpot", lead: "Empty Cup Digital", match: ["Empty Cup Digital", "HubSpot"] },
      { name: "Arrows", lead: "LeanLayer", match: ["Arrows", "LeanLayer"] },
      { name: "ClickUp", lead: "New Contractor", match: ["ClickUp"] },
    ],
  },
  {
    name: "Product",
    members: [
      { name: "Scheduling", lead: "Michal Bieszczad" },
      { name: "Clinical", lead: "Chandler Muzayyin" },
      { name: "Financial Ops", lead: "Andres Palacio" },
      { name: "Client Experience", lead: "Maddy Campbell" },
      { name: "Practice Management", lead: "Valentia Perez" },
      { name: "AI & Automation", lead: "Ankita Avadhani", match: ["AI", "Automation", "Concierge", "Product"] },
    ],
  },
  { name: "Data", members: [{ name: "Data", lead: "Josh Malarkey", match: ["Data"] }] },
  { name: "Engineering", members: [{ name: "Engineering", lead: "Ryan Burbank", match: ["Engineering"] }] },
  {
    name: "Customer Growth",
    members: [
      { name: "Practice Success", lead: "Sarah Thaler", pm: "New Hire PM", match: ["Practice Success"] },
      {
        name: "Practice Ops", lead: "Miki Lager", pm: "Jennifer Denton",
        sub: [
          { name: "Supplies", lead: "Shannon Aubert", match: ["Supplies"] },
          { name: "Onboarding", lead: "Leslie Nichols" },
          { name: "MD Ops", lead: "Ashley Pope" },
          { name: "Financial Services", lead: "Jennifer Denton" },
          { name: "Migrations", lead: "Amira Aldewick" },
        ],
      },
      {
        name: "Marketing Services", lead: "Johanna Singer", pm: "Christina Robichaux", match: ["Marketing Services"],
        sub: [
          { name: "Paid Media", lead: "Jenn Peterson", match: ["Paid Media"] },
          { name: "Website", lead: "Christina Robichaux" },
          { name: "Events", lead: "Reyna Bovee" },
        ],
      },
    ],
  },
  { name: "Legal", members: [{ name: "Legal", lead: "Stephanie Hudson" }] },
  { name: "People", members: [{ name: "People", lead: "Lydia Bowers" }] },
  { name: "Finance", members: [{ name: "Finance", lead: "Chrissy Lo", pm: "Robin Soukup" }] },
  { name: "BizOps", members: [{ name: "BizOps", lead: "Ben Kosowsky", pm: "Maya Kashlan" }] },
];

/* ---------- edit lock ---------- */
const EDIT_PW = "12345678";
const KEY_STORE = "portfolio_edit_key";
function getEditKey() { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } }
function storeEditKey(k) { try { localStorage.setItem(KEY_STORE, k); } catch {} }
function clearEditKey() { try { localStorage.removeItem(KEY_STORE); } catch {} }

async function apiWrite(path, method, payload) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-edit-key": getEditKey() },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Editing is locked. Unlock with the password to make changes.");
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ---------- resourcing helpers ---------- */
function projectHaystack(p) {
  return [
    p.workstream, p.stakeholder, p.revopsRole, p.devResources,
    ...(p.teams || []),
    ...(p.contractors || []).map((c) => c.name),
    ...(p.roles || []).map((r) => r.who),
  ].join(" ").toLowerCase();
}
function resourceProjects(resource, projects) {
  if (!resource.match) return [];
  return projects.filter((p) => {
    const h = projectHaystack(p);
    return resource.match.some((m) => h.includes(m.toLowerCase()));
  });
}
function projectLoad(p) { return SIZE_POINTS[p.size] || SIZE_POINTS.M; }
function allResources() {
  const out = [];
  ORG.forEach((g) => {
    g.members.forEach((m) => {
      if (!m.sub) out.push({ group: g.name, label: m.name, lead: m.lead, pm: m.pm, match: m.match });
      (m.sub || []).forEach((s) => out.push({ group: g.name, label: s.name, parent: m.name, lead: s.lead, match: s.match }));
      if (m.sub && m.match) out.push({ group: g.name, label: m.name, lead: m.lead, pm: m.pm, match: m.match });
    });
  });
  return out;
}

/* ---------- atoms ---------- */
function Eyebrow({ children, color }) {
  return <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: color || T.inkSoft }}>{children}</span>;
}
function Chip({ children, bg, fg, border }) {
  return (
    <span style={{ fontFamily: T.body, fontSize: 11.5, fontWeight: 500, padding: "3px 9px", borderRadius: 999, background: bg || T.hairlineSoft, color: fg || T.ink, border: border ? `1px solid ${border}` : "none", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
function ScoreDots({ value, color }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ width: 7, height: 7, borderRadius: 999, background: n <= value ? color : T.hairline }} />)}
    </span>
  );
}
function SizeChip({ size, ws }) {
  const s = size || "M";
  return (
    <span title={`${SIZE_LABEL[s]} build · ${SIZE_POINTS[s]} work units`} style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: (ws && ws.soft) || T.hairlineSoft, color: (ws && ws.color) || T.inkSoft, letterSpacing: "0.04em" }}>
      {s}
    </span>
  );
}
function initials(name) {
  return (name || "").split(/[\s·]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function Avatar({ name, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 999, background: (color || T.inkSoft) + "22", color: color || T.inkSoft, fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </span>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [view, setView] = useState("board");
  const [projects, setProjects] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [wsFilter, setWsFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [unlocked, setUnlocked] = useState(() => getEditKey() === EDIT_PW);

  const refresh = async () => {
    try {
      setLoadError("");
      const [pr, st] = await Promise.all([fetch("/api/projects"), fetch("/api/settings")]);
      if (!pr.ok) { const e = await pr.json().catch(() => ({})); throw new Error(e.error || `Could not load projects (${pr.status})`); }
      setProjects(await pr.json());
      if (st.ok) { const s = await st.json(); setCapacities(s.capacities || {}); }
    } catch (e) { setLoadError(e.message); } finally { setLoaded(true); }
  };
  useEffect(() => { refresh(); }, []);

  const toggleLock = () => {
    if (unlocked) { clearEditKey(); setUnlocked(false); return; }
    const pw = window.prompt("Enter the edit password to unlock editing:");
    if (pw == null) return;
    if (pw === EDIT_PW) { storeEditKey(pw); setUnlocked(true); } else window.alert("Incorrect password.");
  };

  const byId = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const visible = wsFilter === "All" ? projects : projects.filter((p) => p.workstream === wsFilter);
  const selected = selectedId ? byId[selectedId] : null;

  const updateProject = async (id, patch) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try { await apiWrite("/api/projects", "PATCH", { id, ...patch }); }
    catch (e) { window.alert(`Couldn't save: ${e.message}`); refresh(); }
  };
  const addProject = async (proj) => { await apiWrite("/api/projects", "POST", proj); await refresh(); setSelectedId(proj.id); };
  const addProjects = async (list) => { for (const proj of list) { await apiWrite("/api/projects", "POST", proj); } await refresh(); };
  const removeProject = async (id) => {
    if (!window.confirm("Remove this project from the portfolio?")) return;
    try { await apiWrite("/api/projects", "DELETE", { id }); setSelectedId(null); await refresh(); }
    catch (e) { window.alert(`Couldn't remove: ${e.message}`); }
  };
  const setCapacity = async (label, value) => {
    const next = { ...capacities, [label]: value };
    setCapacities(next);
    try { await apiWrite("/api/settings", "PUT", { capacities: next }); }
    catch (e) { window.alert(`Couldn't save capacity: ${e.message}`); refresh(); }
  };

  const workstreams = ["All", ...Array.from(new Set(projects.map((p) => p.workstream)))];
  const views = [["board", "Board"], ["matrix", "Priority matrix"], ["sequence", "Sequence"], ["resourcing", "Resourcing"]];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: T.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        button:focus-visible, select:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid ${T.ink}; outline-offset: 2px; }
        .proj-drawer { width: min(680px, 100%); }
        .proj-grid { display: flex; flex-direction: column; gap: 16px; }
        .proj-wide-only { display: none !important; }
        @media (min-width: 1080px) {
          .proj-drawer { width: min(1120px, 96vw); }
          .proj-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr); gap: 20px; align-items: start; }
          .proj-narrow-only { display: none !important; }
          .proj-wide-only { display: block !important; }
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={{ padding: "26px 28px 0", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Eyebrow>MOXIE · REVOPS · {projects.length} PROJECTS</Eyebrow>
            <h1 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 34, lineHeight: 1.05, margin: "6px 0 0", letterSpacing: "-0.02em" }}>Project Portfolio</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: T.inkSoft, maxWidth: 560 }}>Scope, priority, sequencing, and resourcing for the RevOps project portfolio — one place.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={toggleLock} title={unlocked ? "Lock editing" : "Unlock editing"} style={btnGhost}>{unlocked ? "🔓 Editing" : "🔒 Locked"}</button>
            {unlocked && <button onClick={() => setShowAdd(true)} style={btnSolid}>+ Add project</button>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 22, borderBottom: `1px solid ${T.hairline}`, paddingBottom: 0 }}>
          <nav style={{ display: "flex", gap: 2 }}>
            {views.map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} style={{ fontFamily: T.body, fontSize: 13.5, fontWeight: view === key ? 600 : 500, padding: "10px 14px", background: "none", border: "none", color: view === key ? T.ink : T.inkSoft, borderBottom: view === key ? `2px solid ${T.ink}` : "2px solid transparent", marginBottom: -1 }}>{label}</button>
            ))}
          </nav>
          {view !== "resourcing" && (
            <div style={{ display: "flex", gap: 6, paddingBottom: 8, flexWrap: "wrap" }}>
              {workstreams.map((w) => {
                const meta = WS[w] || WS.Other;
                const active = wsFilter === w;
                return (
                  <button key={w} onClick={() => setWsFilter(w)} style={{ fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 999, border: `1px solid ${active ? (w === "All" ? T.ink : meta.color) : T.hairline}`, background: active ? (w === "All" ? T.ink : meta.soft) : T.surface, color: active ? (w === "All" ? "#fff" : meta.color) : T.inkSoft }}>{w}</button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 28px 60px" }}>
        {!loaded ? <p style={{ color: T.inkSoft, fontSize: 14 }}>Loading…</p>
          : loadError ? (
            <div style={{ background: "#FBEAEA", border: "1px solid #E3B9B9", borderRadius: 12, padding: 20, maxWidth: 560 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#A33D3D" }}>Couldn't load the portfolio</p>
              <p style={{ margin: "6px 0 12px", fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{loadError}</p>
              <button onClick={refresh} style={btnSolid}>Try again</button>
            </div>
          ) : view === "board" ? <Board projects={visible} onOpen={setSelectedId} />
            : view === "matrix" ? <Matrix projects={visible} onOpen={setSelectedId} />
              : view === "sequence" ? <Sequence projects={visible} byId={byId} onOpen={setSelectedId} />
                : <Resourcing projects={projects} capacities={capacities} unlocked={unlocked} onSetCapacity={setCapacity} onOpen={setSelectedId} />}
      </main>

      {selected && <Detail p={selected} byId={byId} unlocked={unlocked} onClose={() => setSelectedId(null)} onUpdate={(patch) => updateProject(selected.id, patch)} onRemove={() => removeProject(selected.id)} onOpen={setSelectedId} />}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addProject} onBulkAdd={addProjects} existing={projects} />}
    </div>
  );
}

/* ---------- BOARD ---------- */
function Board({ projects, onOpen }) {
  if (!projects.length) return <Empty />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
      {projects.map((p) => {
        const ws = WS[p.workstream] || WS.Other;
        return (
          <button key={p.id} onClick={() => onOpen(p.id)} style={{ textAlign: "left", background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10, borderTop: `3px solid ${ws.color}`, transition: "box-shadow .15s", fontFamily: T.body }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 18px rgba(28,37,33,.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Eyebrow color={ws.color}>{p.code}</Eyebrow><SizeChip size={p.size} ws={ws} /></div>
              <Chip bg={statusBg(p.status)} fg={statusFg(p.status)}>{p.status}</Chip>
            </div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17.5, lineHeight: 1.2, letterSpacing: "-0.01em", color: T.ink }}>{p.title}</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: T.inkSoft, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.problem}</p>
            <div style={{ display: "flex", gap: 18, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: T.inkSoft }}>Impact&nbsp;&nbsp;<ScoreDots value={p.impact} color={ws.color} /></span>
              <span style={{ fontSize: 11, color: T.inkSoft }}>Effort&nbsp;&nbsp;<ScoreDots value={p.effort} color={T.ink} /></span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- MATRIX ---------- */
function Matrix({ projects, onOpen }) {
  if (!projects.length) return <Empty />;
  const W = 860, H = 560, PAD = 56;
  const x = (effort) => PAD + ((effort - 0.5) / 5) * (W - PAD - 20);
  const y = (impact) => H - PAD - ((impact - 0.5) / 5) * (H - PAD - 30);
  const seen = {};
  const pts = projects.map((p) => {
    const key = `${p.effort}-${p.impact}`;
    const n = seen[key] || 0; seen[key] = n + 1;
    return { p, dx: (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 26, dy: n * 6 };
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 18, alignItems: "start" }}>
      <div>
        <h2 style={{ ...h2Style, marginBottom: 10 }}>Impact vs. effort</h2>
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 10, overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, display: "block" }} role="img" aria-label="Impact versus effort matrix">
            <rect x={PAD} y={30} width={(W - PAD - 20) / 2} height={(H - PAD - 30) / 2} fill="#EDF6F0" rx={8} />
            {[1, 2, 3, 4, 5].map((n) => (
              <g key={n}>
                <line x1={x(n)} y1={30} x2={x(n)} y2={H - PAD} stroke={T.hairlineSoft} />
                <line x1={PAD} y1={y(n)} x2={W - 20} y2={y(n)} stroke={T.hairlineSoft} />
                <text x={x(n)} y={H - PAD + 20} textAnchor="middle" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{n}</text>
                <text x={PAD - 14} y={y(n) + 4} textAnchor="end" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{n}</text>
              </g>
            ))}
            <line x1={x(3)} y1={30} x2={x(3)} y2={H - PAD} stroke={T.hairline} strokeDasharray="4 4" />
            <line x1={PAD} y1={y(3)} x2={W - 20} y2={y(3)} stroke={T.hairline} strokeDasharray="4 4" />
            <text x={PAD + 12} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#0E8A74" letterSpacing="1">QUICK WINS</text>
            <text x={W - 32} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.inkSoft} letterSpacing="1" textAnchor="end">BIG BETS</text>
            <text x={W - 32} y={H - PAD - 12} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#A33D3D" letterSpacing="1" textAnchor="end">RECONSIDER</text>
            <text x={(PAD + W - 20) / 2} y={H - 10} textAnchor="middle" fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600">Effort →</text>
            <text x={16} y={(30 + H - PAD) / 2} fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600" transform={`rotate(-90 16 ${(30 + H - PAD) / 2})`} textAnchor="middle">Impact →</text>
            {pts.map(({ p, dx, dy }) => {
              const ws = WS[p.workstream] || WS.Other;
              const cx = x(p.effort) + dx, cy = y(p.impact) + dy;
              return (
                <g key={p.id} onClick={() => onOpen(p.id)} style={{ cursor: "pointer" }}>
                  <circle cx={cx} cy={cy} r={13} fill={ws.color} opacity="0.92" />
                  <circle cx={cx} cy={cy} r={13} fill="none" stroke="#fff" strokeWidth="2" />
                  <text x={cx} y={cy - 19} textAnchor="middle" fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.ink}>{p.code}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 14 }}>
        <SectionTitle>Projects</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {projects.map((p) => {
            const ws = WS[p.workstream] || WS.Other;
            return (
              <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: "flex", gap: 9, alignItems: "baseline", textAlign: "left", background: "none", border: "none", padding: "2px 0", fontFamily: T.body }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: ws.color, flexShrink: 0, transform: "translateY(1px)" }} />
                <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, color: ws.color, minWidth: 42 }}>{p.code}</span>
                <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.35 }}>{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- SEQUENCE (dependency graph with arrows) ---------- */
function Sequence({ projects, byId, onOpen }) {
  if (!projects.length) return <Empty />;
  const visibleIds = new Set(projects.map((p) => p.id));
  const levelOf = (p, depth = 0) => {
    if (depth > 6) return 0;
    const deps = (p.dependsOn || []).filter((d) => byId[d.id] && visibleIds.has(d.id));
    if (!deps.length) return 0;
    return 1 + Math.max(...deps.map((d) => levelOf(byId[d.id], depth + 1)));
  };
  const cols = [];
  projects.forEach((p) => { const lv = Math.min(levelOf(p), 2); (cols[lv] = cols[lv] || []).push(p); });
  const colTitles = ["Foundations", "Unlocked next", "Later"];

  const NODE_W = 208, NODE_H = 60, V_GAP = 16, COL_GAP = 78, TOP = 44, LEFT = 6;
  const colX = (lv) => LEFT + lv * (NODE_W + COL_GAP);
  const pos = {};
  cols.forEach((col, lv) => (col || []).forEach((p, i) => { pos[p.id] = { x: colX(lv), y: TOP + i * (NODE_H + V_GAP) }; }));
  const usedCols = cols.filter(Boolean).length;
  const maxRows = Math.max(1, ...cols.filter(Boolean).map((c) => c.length));
  const width = colX(usedCols - 1) + NODE_W + LEFT;
  const height = TOP + maxRows * (NODE_H + V_GAP) + 8;

  const edges = [];
  projects.forEach((p) => (p.dependsOn || []).forEach((d) => { if (pos[d.id] && pos[p.id]) edges.push([d.id, p.id]); }));

  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={h2Style}>Sequencing by dependency</h2>
        <span style={{ fontSize: 12, color: T.inkSoft }}>Arrows point from a prerequisite to what it unlocks.</span>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 12, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${Math.max(width, 320)} ${height}`} style={{ width: "100%", minWidth: Math.min(width, 900), display: "block" }} role="img" aria-label="Dependency sequence">
          <defs>
            <marker id="seqArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#A33D3D" />
            </marker>
          </defs>
          {cols.map((col, lv) => col && col.length ? (
            <text key={lv} x={colX(lv)} y={22} fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.inkSoft} letterSpacing="0.06em">{colTitles[lv].toUpperCase()}</text>
          ) : null)}
          {edges.map(([from, to], i) => {
            const a = pos[from], b = pos[to];
            const sx = a.x + NODE_W, sy = a.y + NODE_H / 2;
            const ex = b.x, ey = b.y + NODE_H / 2;
            const mx = (sx + ex) / 2;
            return <path key={i} d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex - 2} ${ey}`} fill="none" stroke="#A33D3D" strokeWidth="1.6" opacity="0.7" markerEnd="url(#seqArrow)" />;
          })}
          {projects.map((p) => {
            const ws = WS[p.workstream] || WS.Other;
            const { x: nx, y: ny } = pos[p.id];
            return (
              <g key={p.id} onClick={() => onOpen(p.id)} style={{ cursor: "pointer" }}>
                <rect x={nx} y={ny} width={NODE_W} height={NODE_H} rx={10} fill={T.surface} stroke={T.hairline} />
                <rect x={nx} y={ny} width={4} height={NODE_H} rx={2} fill={ws.color} />
                <text x={nx + 16} y={ny + 23} fontSize="10.5" fontFamily={T.mono} fontWeight="600" fill={ws.color} letterSpacing="0.06em">{p.code} · {p.size || "M"}</text>
                <text x={nx + 16} y={ny + 41} fontSize="12.5" fontFamily={T.body} fontWeight="600" fill={T.ink}>{trunc(p.title, 24)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ---------- RESOURCING (allocation chart) ---------- */
function Resourcing({ projects, capacities, unlocked, onSetCapacity, onOpen }) {
  const enriched = allResources().map((r) => {
    const ps = resourceProjects(r, projects);
    return { ...r, projects: ps, units: ps.reduce((s, p) => s + projectLoad(p), 0) };
  });
  const byGroup = {};
  enriched.forEach((r) => { if (r.projects.length) (byGroup[r.group] = byGroup[r.group] || []).push(r); });
  const activeGroups = ORG.map((g) => g.name).filter((g) => byGroup[g]);
  const idleGroups = ORG.map((g) => g.name).filter((g) => !byGroup[g]);
  const involved = (r, p) => r.projects.some((x) => x.id === p.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ ...h2Style, marginBottom: 2 }}>Resourcing & allocation</h2>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: 0 }}>Teams × projects. Each cell is the project's work units; the total is allocated load.{unlocked ? " Capacity is editable." : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft }}>
          <span style={{ letterSpacing: "0.06em" }}>WORK UNITS</span>
          {SIZES.map((s) => <span key={s} style={{ padding: "2px 7px", borderRadius: 6, background: T.hairlineSoft, color: T.ink, fontWeight: 700 }}>{s} = {SIZE_POINTS[s]}</span>)}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760, fontFamily: T.body }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 210, position: "sticky", left: 0, background: T.paper, zIndex: 1 }}>Team / resource</th>
              {projects.map((p) => {
                const ws = WS[p.workstream] || WS.Other;
                return (
                  <th key={p.id} style={{ ...thStyle }}>
                    <button onClick={() => onOpen(p.id)} title={p.title} style={{ background: "none", border: "none", color: ws.color, fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>{p.code}</button>
                  </th>
                );
              })}
              <th style={{ ...thStyle, borderLeft: `1px solid ${T.hairline}` }}>Allocated</th>
              <th style={thStyle}>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {activeGroups.map((g) => (
              <ResourceGroup key={g} group={g} rows={byGroup[g]} projects={projects} capacities={capacities} unlocked={unlocked} onSetCapacity={onSetCapacity} involved={involved} />
            ))}
          </tbody>
        </table>
      </div>

      {idleGroups.length > 0 && (
        <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: "12px 16px" }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.inkSoft, marginRight: 8 }}>NOT YET STAFFED</span>
          <span style={{ fontSize: 12.5, color: T.inkSoft }}>{idleGroups.join(" · ")}</span>
        </div>
      )}
    </div>
  );
}

function ResourceGroup({ group, rows, projects, capacities, unlocked, onSetCapacity, involved }) {
  return (
    <>
      <tr>
        <td colSpan={projects.length + 3} style={{ padding: "10px 14px 4px", background: T.paper, fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkSoft }}>{group}</td>
      </tr>
      {rows.map((r) => {
        const cap = capacities[r.label] ?? DEFAULT_CAP;
        const over = r.units > cap;
        return (
          <tr key={r.label} style={{ borderTop: `1px solid ${T.hairlineSoft}` }}>
            <td style={{ padding: "9px 14px", fontSize: 13, position: "sticky", left: 0, background: T.surface }}>
              <span style={{ fontWeight: 600 }}>{r.parent ? `${r.parent} · ${r.label}` : r.label}</span>
              {r.lead && <span style={{ marginLeft: 8, fontSize: 11, color: T.inkSoft }}>{r.lead}</span>}
            </td>
            {projects.map((p) => {
              const ws = WS[p.workstream] || WS.Other;
              const on = involved(r, p);
              return (
                <td key={p.id} style={{ textAlign: "center", padding: "9px 6px" }}>
                  {on ? <span title={`${p.code} · ${SIZE_LABEL[p.size || "M"]} · ${projectLoad(p)} units`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 6px", borderRadius: 6, background: ws.soft, color: ws.color, fontFamily: T.mono, fontSize: 11.5, fontWeight: 700 }}>{projectLoad(p)}</span> : null}
                </td>
              );
            })}
            <td style={{ textAlign: "center", fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: over ? "#C0463E" : T.ink, borderLeft: `1px solid ${T.hairline}` }}>
              {r.units}{over && " ⚠"}
            </td>
            <td style={{ textAlign: "center" }}>
              {unlocked
                ? <input type="number" min="1" value={cap} onChange={(e) => onSetCapacity(r.label, Math.max(1, Number(e.target.value) || 1))} style={{ width: 46, fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: "2px 4px", border: `1px solid ${T.hairline}`, borderRadius: 6, color: T.ink, background: T.surface, textAlign: "center" }} />
                : <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>{cap}</span>}
            </td>
          </tr>
        );
      })}
    </>
  );
}

/* ---------- DETAIL DRAWER ---------- */
function Detail({ p, byId, unlocked, onClose, onUpdate, onRemove, onOpen }) {
  const ws = WS[p.workstream] || WS.Other;
  const deps = p.dependsOn || [];
  const contractors = p.contractors || [];
  const committed = (p.deliverables || []).filter((d) => !d.stretch);
  const stretch = (p.deliverables || []).filter((d) => d.stretch);

  // de-dup (locked view): drop roles that are an actual contractor by name
  const contractorNames = contractors.map((c) => (c.name || "").toLowerCase().trim());
  const roleHidden = (who) => {
    const w = (who || "").toLowerCase().trim();
    if (!contractors.length) return false;
    if (w === "contractor" || w === "contractors") return true;
    return contractorNames.some((n) => n && (w === n || w.startsWith(n)));
  };
  const rolesView = (p.roles || []).filter((r) => !roleHidden(r.who));
  const depOptions = Object.values(byId).filter((x) => x.id !== p.id);

  const targetOpts = Array.from(new Set([p.targetWindow || "TBD", ...TARGETS]));
  const targetCtl = unlocked
    ? <MiniSelect value={p.targetWindow || "TBD"} options={targetOpts} onChange={(v) => onUpdate({ targetWindow: v })} />
    : <span style={{ fontSize: 13, fontWeight: 600 }}>{p.targetWindow || "TBD"}</span>;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div className="proj-drawer" onClick={(e) => e.stopPropagation()} style={{ height: "100%", background: T.bg, overflowY: "auto", boxShadow: "-12px 0 40px rgba(28,37,33,.18)", fontFamily: T.body }}>
        {/* header band */}
        <div style={{ padding: "22px 26px 18px", background: T.surface, borderBottom: `1px solid ${T.hairline}`, position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Eyebrow color={ws.color}>{p.code}</Eyebrow>
                {unlocked
                  ? <MiniSelect value={p.workstream} options={WORKSTREAMS} onChange={(v) => onUpdate({ workstream: v })} />
                  : <Chip bg={ws.soft} fg={ws.color}>{p.workstream}</Chip>}
              </div>
              {unlocked
                ? <div style={{ marginTop: 8 }}><TextEdit value={p.title} placeholder="Project title" big onCommit={(v) => onUpdate({ title: v })} /></div>
                : <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 24, margin: "8px 0 0", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{p.title}</h2>}
              {(unlocked || p.dri) && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft }}>DRI</span>
                  {unlocked ? <TextEdit value={p.dri} placeholder="Accountable owner" onCommit={(v) => onUpdate({ dri: v })} /> : <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{p.dri}</span>}
                </div>
              )}
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 8, width: 32, height: 32, fontSize: 16, color: T.inkSoft, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 16, border: `1px solid ${T.hairline}`, borderRadius: 10, overflow: "hidden" }}>
            <Stat label="Status">{unlocked ? <MiniSelect value={p.status} options={STATUSES} onChange={(v) => onUpdate({ status: v })} /> : <Chip bg={statusBg(p.status)} fg={statusFg(p.status)}>{p.status}</Chip>}</Stat>
            <Stat label="Impact">{unlocked ? <MiniSelect value={p.impact} options={[1, 2, 3, 4, 5]} onChange={(v) => onUpdate({ impact: Number(v) })} /> : <ScoreDots value={p.impact} color={ws.color} />}</Stat>
            <Stat label="Effort">{unlocked ? <MiniSelect value={p.effort} options={[1, 2, 3, 4, 5]} onChange={(v) => onUpdate({ effort: Number(v) })} /> : <ScoreDots value={p.effort} color={T.ink} />}</Stat>
            <Stat label="Size">{unlocked ? <MiniSelect value={p.size || "M"} options={SIZES} onChange={(v) => onUpdate({ size: v })} /> : <SizeChip size={p.size} ws={ws} />}</Stat>
            <Stat label="Target" className="proj-wide-only">{targetCtl}</Stat>
          </div>
          <div className="proj-narrow-only" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
            <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft }}>TARGET</span>{targetCtl}
          </div>
        </div>

        <div className="proj-grid" style={{ padding: "20px 26px 6px" }}>
          {/* MAIN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <AccentCard accent="#C0463E" icon="!" title="The problem">
              {unlocked ? <AreaEdit value={p.problem} onCommit={(v) => onUpdate({ problem: v })} /> : <p style={cardText}>{p.problem}</p>}
            </AccentCard>
            <AccentCard accent={ws.color} icon="→" title="The solution">
              {unlocked ? <AreaEdit value={p.solution} onCommit={(v) => onUpdate({ solution: v })} /> : <p style={cardText}>{p.solution}</p>}
            </AccentCard>

            <Panel title={`What's being built${committed.length ? ` · ${committed.length}` : ""}`}>
              {unlocked ? <DeliverableEditor items={p.deliverables || []} accent={ws.color} onCommit={(v) => onUpdate({ deliverables: v })} /> : (
                <>
                  <ul style={listReset}>
                    {committed.map((d, i) => (
                      <li key={i} style={liRow}><span style={{ color: ws.color, fontWeight: 700, marginTop: 1 }}>✓</span><span>{d.text}</span></li>
                    ))}
                  </ul>
                  {stretch.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.hairline}` }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: "#9A6A12", marginBottom: 8 }}>STRETCH — IF TIME ALLOWS</div>
                      <ul style={listReset}>
                        {stretch.map((d, i) => <li key={i} style={{ ...liRow, color: T.inkSoft }}><span style={{ color: "#C9A24B", marginTop: 1 }}>○</span><span>{d.text}</span></li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Panel>

            <div style={{ background: "#EDF6F0", border: "1px solid #C9E4D6", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 14 }}>🎯</span><SectionTitle>Definition of success</SectionTitle></div>
              {unlocked ? <AreaEdit value={p.success} onCommit={(v) => onUpdate({ success: v })} /> : <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: T.ink }}>{p.success}</p>}
            </div>
          </div>

          {/* RAIL */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {(contractors.length > 0 || unlocked) && (
              <Panel title="Resourcing">
                {unlocked ? <ContractorEditor items={contractors} onCommit={(v) => onUpdate({ contractors: v })} /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {contractors.map((c, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span><StatusTag status={c.status} />
                        </div>
                        {c.scope && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{c.scope}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {(rolesView.length > 0 || unlocked) && (
              <Panel title="Who does what">
                {unlocked ? <RoleEditor items={p.roles || []} accent={ws.color} onCommit={(v) => onUpdate({ roles: v })} /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rolesView.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13 }}>
                        <Avatar name={r.who} color={ws.color} />
                        <div><span style={{ fontWeight: 600 }}>{r.who}</span><div style={{ color: T.inkSoft, lineHeight: 1.45, marginTop: 1 }}>{r.what}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {(deps.length > 0 || unlocked) && (
              <Panel title="Depends on">
                {unlocked ? <DependsEditor items={deps} options={depOptions} onCommit={(v) => onUpdate({ dependsOn: v })} /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {deps.map((d, i) => {
                      const dep = byId[d.id];
                      return (
                        <div key={i} style={{ fontSize: 13, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ color: "#A33D3D", fontWeight: 700 }}>↳</span>
                          <span>
                            {dep ? <button onClick={() => onOpen(dep.id)} style={linkBtn}>{dep.code} — {dep.title}</button> : <span style={{ fontWeight: 600 }}>Outside this portfolio</span>}
                            {d.note && <span style={{ color: T.inkSoft }}> — {d.note}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            )}

            {((p.openItems || []).length > 0 || unlocked) && (
              <div style={{ background: "#FFF8EC", border: "1px solid #EFDFBC", borderRadius: 12, padding: "12px 16px" }}>
                <SectionTitle>Risks & assumptions</SectionTitle>
                {unlocked ? <div style={{ marginTop: 8 }}><StringListEditor items={p.openItems || []} placeholder="Add a risk or assumption" onCommit={(v) => onUpdate({ openItems: v })} /></div>
                  : <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#6E5612" }}>{p.openItems.map((o, i) => <li key={i}>{o}</li>)}</ul>}
              </div>
            )}

            <Panel title="Ownership">
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                {p.dri && <div style={{ marginBottom: 4 }}><span style={{ color: T.inkSoft }}>DRI · </span><span style={{ fontWeight: 600 }}>{p.dri}</span></div>}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: T.inkSoft }}>Stakeholder · </span>
                  {unlocked ? <TextEdit value={p.stakeholder} placeholder="Stakeholder team" onCommit={(v) => onUpdate({ stakeholder: v })} /> : <span style={{ fontWeight: 600 }}>{p.stakeholder}</span>}
                </div>
              </div>
            </Panel>
          </aside>
        </div>

        {unlocked && (
          <div style={{ padding: "8px 26px 32px" }}>
            <button onClick={onRemove} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "9px 14px", borderRadius: 8, background: "none", border: "1px solid #D9A0A0", color: "#A33D3D" }}>Remove project</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- inline editors ---------- */
function TextEdit({ value, placeholder, onCommit, big }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return (
    <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== (value || "")) onCommit(v); }}
      style={{ fontFamily: big ? T.display : T.body, fontSize: big ? 20 : 12.5, fontWeight: big ? 800 : 600, letterSpacing: big ? "-0.01em" : 0, padding: big ? "4px 8px" : "3px 7px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, minWidth: big ? "100%" : 150, width: big ? "100%" : undefined }} />
  );
}
function AreaEdit({ value, onCommit, rows = 3 }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return (
    <textarea value={v} rows={rows} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== (value || "")) onCommit(v); }}
      style={{ width: "100%", fontFamily: T.body, fontSize: 13, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, resize: "vertical" }} />
  );
}
function DeliverableEditor({ items, accent, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {list.map((d, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <button title={d.stretch ? "Stretch — click to commit" : "Committed — click to mark stretch"} onClick={() => push(list.map((x, j) => j === i ? { ...x, stretch: !x.stretch } : x))} style={{ background: "none", border: "none", fontSize: 14, color: d.stretch ? "#C9A24B" : accent, width: 18 }}>{d.stretch ? "○" : "✓"}</button>
          <input value={d.text} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Deliverable"
            style={{ flex: 1, fontFamily: T.body, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }} />
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, { text: "", stretch: false }])} style={addBtn}>+ Add deliverable</button>
    </div>
  );
}
function RoleEditor({ items, accent, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {list.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <Avatar name={r.who || "?"} color={accent} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <input value={r.who} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, who: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Who"
              style={{ fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }} />
            <input value={r.what} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, what: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Responsibility"
              style={{ fontFamily: T.body, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.inkSoft }} />
          </div>
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, { who: "", what: "" }])} style={addBtn}>+ Add role</button>
    </div>
  );
}
function ContractorEditor({ items, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {list.map((c, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5, borderBottom: i < list.length - 1 ? `1px solid ${T.hairlineSoft}` : "none", paddingBottom: 7 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <input value={c.name} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Contractor"
              style={{ flex: 1, fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }} />
            <select value={c.status === "Engaged" ? "Engaged" : "TBD"} onChange={(e) => push(list.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} style={{ fontFamily: T.body, fontSize: 12, padding: "4px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}>
              <option value="Engaged">Engaged</option><option value="TBD">TBD</option>
            </select>
            <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
          </div>
          <input value={c.scope} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, scope: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Scope"
            style={{ fontFamily: T.body, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.inkSoft }} />
        </div>
      ))}
      <button onClick={() => push([...list, { name: "", scope: "", status: "TBD" }])} style={addBtn}>+ Add contractor</button>
    </div>
  );
}
function StringListEditor({ items, placeholder, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {list.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <input value={s} onChange={(e) => setList(list.map((x, j) => j === i ? e.target.value : x))} onBlur={() => onCommit(list)} placeholder={placeholder}
            style={{ flex: 1, fontFamily: T.body, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: `1px solid #E2CF9E`, background: "#FFFDF7", color: "#6E5612" }} />
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, ""])} style={addBtn}>+ Add item</button>
    </div>
  );
}
function DependsEditor({ items, options, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((d, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <select value={d.id || ""} onChange={(e) => push(list.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} style={{ fontFamily: T.body, fontSize: 12.5, padding: "4px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}>
            <option value="">Outside portfolio</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
          </select>
          <input value={d.note || ""} onChange={(e) => setList(list.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} onBlur={() => onCommit(list)} placeholder="Why it's a prerequisite"
            style={{ flex: 1, minWidth: 120, fontFamily: T.body, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.inkSoft }} />
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, { id: "", note: "" }])} style={addBtn}>+ Add dependency</button>
    </div>
  );
}

function Stat({ label, children, className }) {
  return (
    <div className={className} style={{ flex: "1 1 0", minWidth: 88, padding: "9px 12px", background: T.surface, borderRight: `1px solid ${T.hairlineSoft}` }}>
      <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.1em", color: T.inkSoft, marginBottom: 5 }}>{label.toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "center", minHeight: 22 }}>{children}</div>
    </div>
  );
}
function StatusTag({ status }) {
  const engaged = (status || "").toLowerCase() === "engaged";
  return <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: 999, background: engaged ? "#E4F3EF" : "#FBEAEA", color: engaged ? "#0E8A74" : "#A33D3D", whiteSpace: "nowrap" }}>{(status || "TBD").toUpperCase()}</span>;
}
function AccentCard({ accent, icon, title, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, background: accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>{icon}</span>
        <SectionTitle>{title}</SectionTitle>
      </div>
      {children}
    </div>
  );
}
function Panel({ title, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ marginBottom: 10 }}><SectionTitle>{title}</SectionTitle></div>
      {children}
    </div>
  );
}
function MiniSelect({ value, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "3px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ---------- CSV import ---------- */
const CSV_COLUMNS = ["title", "workstream", "size", "impact", "effort", "target", "status", "dri", "stakeholder", "problem", "solution", "success", "deliverables", "roles", "contractors", "dependsOn", "openItems"];
const CSV_TEMPLATE = `title,workstream,size,impact,effort,target,status,dri,stakeholder,problem,solution,success,deliverables,roles,contractors,dependsOn,openItems
"Example Project","Supplies",L,4,3,"Q4 2026","Scoping","Shannon Aubert","Supplies team","The pain and what it costs today.","The approach in plain language.","Measurable outcome and who owns it.","Build the thing | Wire up the sync | *Nice-to-have stretch","RevOps :: Architects and builds | Data :: Pipelines","Empty Cup Digital :: HubSpot build :: Engaged | ClickUp Co :: Workflows :: TBD","SUP-01 :: extends its foundation","Vendor API feasibility unvalidated | Contractor unsourced"`;

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function csvToProjects(text, existing) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { projects: [], error: "Need a header row and at least one project row." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r, name) => { const j = header.indexOf(name.toLowerCase()); return j >= 0 ? (r[j] || "").trim() : ""; };
  if (!header.includes("title")) return { projects: [], error: 'CSV must include a "title" column.' };

  const codeToId = {};
  existing.forEach((p) => { codeToId[p.code.toLowerCase()] = p.id; codeToId[p.id.toLowerCase()] = p.id; });
  const used = new Set(existing.map((p) => p.id));
  const items = (s) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);
  const num = (v, d) => { const n = Number(v); return n >= 1 && n <= 5 ? n : d; };
  const out = [];

  for (let k = 1; k < rows.length; k++) {
    const r = rows[k];
    const title = at(r, "title"); if (!title) continue;
    let ws = at(r, "workstream"); if (!WORKSTREAMS.includes(ws)) ws = "Other";
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "project";
    let id = base, n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id);
    const size = (at(r, "size") || "M").toUpperCase();
    out.push({
      id, code: id.toUpperCase(), title, workstream: ws,
      dri: at(r, "dri"), targetWindow: at(r, "target") || "TBD", stakeholder: at(r, "stakeholder"),
      problem: at(r, "problem"), solution: at(r, "solution"), success: at(r, "success"),
      deliverables: items(at(r, "deliverables")).map((t) => t.startsWith("*") ? { text: t.slice(1).trim(), stretch: true } : { text: t, stretch: false }),
      roles: items(at(r, "roles")).map((e) => { const [who, ...rest] = e.split("::"); return { who: (who || "").trim(), what: rest.join("::").trim() }; }).filter((x) => x.who),
      contractors: items(at(r, "contractors")).map((e) => { const a = e.split("::").map((x) => x.trim()); return { name: a[0] || "", scope: a[1] || "", status: a[2] === "Engaged" ? "Engaged" : "TBD" }; }).filter((x) => x.name),
      dependsOn: items(at(r, "dependson")).map((e) => { const a = e.split("::").map((x) => x.trim()); const ref = (a[0] || "").toLowerCase(); return { id: codeToId[ref] || ref, note: a[1] || "" }; }).filter((x) => x.id),
      openItems: items(at(r, "openitems")),
      teams: [], impact: num(at(r, "impact"), 3), effort: num(at(r, "effort"), 3),
      size: SIZES.includes(size) ? size : "M", status: at(r, "status") || "Scoping",
    });
  }
  return { projects: out, error: out.length ? "" : "No rows with a title were found." };
}

/* ---------- ADD MODAL (form or CSV) ---------- */
function AddModal({ onClose, onAdd, onBulkAdd, existing }) {
  const [mode, setMode] = useState("single");
  const [f, setF] = useState({ title: "", workstream: "Marketing Services", size: "M", impact: 3, effort: 3, targetWindow: "Q3 2026", dri: "", problem: "", solution: "" });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const parsed = useMemo(() => csvToProjects(csv, existing), [csv, existing]);

  const submitSingle = () => {
    if (!f.title.trim()) { setErr("Title is required."); return; }
    const base = f.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "project";
    let id = base, n = 2;
    while (existing.some((p) => p.id === id)) { id = `${base}-${n++}`; }
    const obj = {
      id, code: id.toUpperCase(), title: f.title.trim(), workstream: f.workstream,
      stakeholder: "", dri: f.dri, targetWindow: f.targetWindow,
      contractors: [], teams: [], problem: f.problem, solution: f.solution,
      deliverables: [], roles: [], success: "", dependsOn: [], openItems: [],
      impact: Number(f.impact), effort: Number(f.effort), size: f.size, status: "Scoping",
    };
    onAdd(obj).then(() => onClose()).catch((e) => setErr(e.message));
  };
  const submitCsv = () => {
    if (!parsed.projects.length) { setErr(parsed.error || "Nothing to import."); return; }
    setBusy(true); setErr("");
    onBulkAdd(parsed.projects).then(() => onClose()).catch((e) => { setErr(e.message); setBusy(false); });
  };
  const onFile = (e) => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => setCsv(String(rd.result || "")); rd.readAsText(file); };

  const field = { fontFamily: T.body, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, width: "100%" };
  const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft, marginBottom: 5, display: "block" };
  const tab = (k, label) => (
    <button onClick={() => { setMode(k); setErr(""); }} style={{ fontFamily: T.body, fontSize: 13, fontWeight: mode === k ? 600 : 500, padding: "7px 14px", background: "none", border: "none", color: mode === k ? T.ink : T.inkSoft, borderBottom: mode === k ? `2px solid ${T.ink}` : "2px solid transparent" }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(660px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <h2 style={{ ...h2Style, marginTop: 0 }}>Add projects</h2>
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.hairline}`, margin: "12px 0 18px" }}>
          {tab("single", "Single project")}
          {tab("csv", "CSV upload")}
        </div>

        {mode === "single" ? (
          <>
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 16px" }}>Fill the essentials — deliverables, roles, dependencies, and risks are editable inline on the project once it opens.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>TITLE</label><input value={f.title} onChange={(e) => { set("title", e.target.value); setErr(""); }} placeholder="Project title" style={field} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>WORKSTREAM</label><select value={f.workstream} onChange={(e) => set("workstream", e.target.value)} style={field}>{WORKSTREAMS.map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
                <div><label style={lbl}>TARGET</label><select value={f.targetWindow} onChange={(e) => set("targetWindow", e.target.value)} style={field}>{TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>SIZE</label><select value={f.size} onChange={(e) => set("size", e.target.value)} style={field}>{SIZES.map((s) => <option key={s} value={s}>{s} · {SIZE_POINTS[s]}u</option>)}</select></div>
                <div><label style={lbl}>IMPACT</label><select value={f.impact} onChange={(e) => set("impact", e.target.value)} style={field}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label style={lbl}>EFFORT</label><select value={f.effort} onChange={(e) => set("effort", e.target.value)} style={field}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              </div>
              <div><label style={lbl}>DRI (optional)</label><input value={f.dri} onChange={(e) => set("dri", e.target.value)} placeholder="Accountable owner" style={field} /></div>
              <div><label style={lbl}>THE PROBLEM</label><textarea value={f.problem} onChange={(e) => set("problem", e.target.value)} rows={3} placeholder="The pain, who feels it, what it costs" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} /></div>
              <div><label style={lbl}>THE SOLUTION</label><textarea value={f.solution} onChange={(e) => set("solution", e.target.value)} rows={3} placeholder="The approach in plain language" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} /></div>
            </div>
            {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "12px 0 0" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={submitSingle} style={btnSolid}>Create & edit</button>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>Upload or paste CSV to add many projects at once. Hand the format below to your planning agent so its output drops straight in.</p>
            <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, lineHeight: 1.6, color: T.inkSoft }}>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.ink, marginBottom: 6 }}>CSV FORMAT</div>
              <div>One row per project. Header columns (any order; extras ignored): <span style={{ fontFamily: T.mono, color: T.ink }}>{CSV_COLUMNS.join(", ")}</span>.</div>
              <div style={{ marginTop: 6 }}>Only <strong>title</strong> is required. <strong>workstream</strong> ∈ {WORKSTREAMS.join(" / ")}; <strong>size</strong> ∈ S/M/L/XL; <strong>impact</strong>/<strong>effort</strong> 1–5.</div>
              <div style={{ marginTop: 6 }}>List cells separate items with <code style={codeChip}>|</code> and sub-fields with <code style={codeChip}>::</code> —</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                <li><strong>deliverables</strong>: <code style={codeChip}>Build X | Wire sync | *Stretch item</code> (prefix <code style={codeChip}>*</code> = stretch)</li>
                <li><strong>roles</strong>: <code style={codeChip}>RevOps :: Builds it | Data :: Pipelines</code></li>
                <li><strong>contractors</strong>: <code style={codeChip}>Empty Cup Digital :: HubSpot build :: Engaged</code> (status Engaged/TBD)</li>
                <li><strong>dependsOn</strong>: <code style={codeChip}>SUP-01 :: why it's needed</code> (reference an existing project code)</li>
                <li><strong>openItems</strong>: <code style={codeChip}>Risk one | Assumption two</code></li>
              </ul>
              <button onClick={() => setCsv(CSV_TEMPLATE)} style={{ ...addBtn, marginTop: 10 }}>Load example row</button>
            </div>
            <label style={lbl}>UPLOAD .CSV</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 12.5, marginBottom: 10 }} />
            <label style={lbl}>OR PASTE CSV</label>
            <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setErr(""); }} rows={8} placeholder="title,workstream,size,..." style={{ ...field, fontFamily: T.mono, fontSize: 12, lineHeight: 1.5, resize: "vertical" }} />
            <div style={{ fontSize: 12.5, color: parsed.error ? "#A33D3D" : T.inkSoft, margin: "8px 0 0" }}>
              {csv.trim() ? (parsed.error || `${parsed.projects.length} project${parsed.projects.length === 1 ? "" : "s"} ready: ${parsed.projects.map((p) => p.title).join(", ")}`) : "Waiting for CSV…"}
            </div>
            {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={submitCsv} disabled={busy || !parsed.projects.length} style={{ ...btnSolid, opacity: busy || !parsed.projects.length ? 0.5 : 1 }}>{busy ? "Importing…" : `Import ${parsed.projects.length || ""} project${parsed.projects.length === 1 ? "" : "s"}`}</button>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
const h2Style = { fontFamily: T.display, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", margin: 0, color: T.ink };
const thStyle = { padding: "12px 8px", fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: T.inkSoft, textAlign: "center", background: T.paper };
const btnGhost = { fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink };
const btnSolid = { fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "none", background: T.ink, color: "#fff" };
const cardText = { margin: 0, fontSize: 13, lineHeight: 1.55, color: T.ink };
const listReset = { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 };
const liRow = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5 };
const linkBtn = { background: "none", border: "none", fontWeight: 600, color: T.ink, fontSize: 13, textDecoration: "underline", padding: 0, fontFamily: T.body };
const xBtn = { background: "none", border: "none", color: T.inkSoft, fontSize: 13, padding: "2px 4px", flexShrink: 0 };
const addBtn = { alignSelf: "flex-start", background: "none", border: `1px dashed ${T.hairline}`, color: T.inkSoft, fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8 };
const codeChip = { fontFamily: T.mono, fontSize: 11.5, background: T.hairlineSoft, color: T.ink, padding: "1px 5px", borderRadius: 4 };

function SectionTitle({ children }) {
  return <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkSoft }}>{children}</span>;
}
function statusBg(s) { return { Scoping: "#EBEFF1", Proposed: "#EFEAFB", Approved: "#E4F3EF", "In flight": "#E0F0FA", Blocked: "#FBEAEA", Done: "#E8F5E2" }[s] || T.hairlineSoft; }
function statusFg(s) { return { Scoping: "#54616B", Proposed: "#6A4FD8", Approved: "#0E8A74", "In flight": "#2371A8", Blocked: "#A33D3D", Done: "#3D7A2E" }[s] || T.inkSoft; }
function Empty() { return <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkSoft, fontSize: 14 }}>Nothing here yet.</div>; }
