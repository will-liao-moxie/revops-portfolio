import { useState, useEffect, useMemo } from "react";

/* ============================================================
   MOXIE REVOPS — PROJECT PORTFOLIO
   One-pagers as structured, comparable data.
   Views: Board · Priority Matrix · Sequence · People
   Data lives in the team Google Sheet, served via /api/projects.
   Edits write back to the sheet for everyone.
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

const STATUSES = ["Scoping", "Proposed", "Approved", "In flight", "Blocked", "Done"];

const GLOSSARY = [
  ["PSM", "Practice Success Manager — the customer's primary point of contact at Moxie"],
  ["OA", "Operations Associate on the Supplies team — handles account setup and order placement"],
  ["Tier 0 / Tier 1", "Tier 0 = self-serve support (Concierge, help docs). Tier 1 = first line of human support"],
  ["Moxie Concierge", "In-product AI assistant inside Moxie Suite that answers provider questions"],
  ["Omni", "Moxie's analytics and dashboarding layer, built on the Data Warehouse"],
  ["Snowflake / Data Warehouse", "Central database where data from all systems is combined for reporting"],
  ["Custom object", "A new record type added to HubSpot to track something it doesn't track by default"],
  ["Empty Cup Digital (ECD)", "Contractor specializing in HubSpot builds"],
  ["ClickUp Contractor", "Contractor for ClickUp workflow builds — not yet sourced"],
  ["Stretch", "Valuable-if-time-allows scope. Not a commitment; the project succeeds without it"],
];

const TEMPLATE_JSON = `{
  "id": "spt-01",
  "code": "SPT-01",
  "title": "Project title",
  "workstream": "Support",
  "stakeholder": "Primary stakeholder team (named lead)",
  "revopsRole": "Project coordinator + ...",
  "devResources": "Teams providing build capacity",
  "contractors": [{ "name": "Contractor name", "scope": "What they build", "status": "Engaged or TBD" }],
  "teams": ["Support", "RevOps"],
  "problem": "2-4 sentences. The pain, who feels it, and what it costs today.",
  "solution": "2-4 sentences. The approach in plain language.",
  "deliverables": [
    { "text": "Concrete thing being built", "stretch": false },
    { "text": "Nice-to-have if time allows", "stretch": true }
  ],
  "roles": [{ "who": "Team or person", "what": "Their responsibility" }],
  "success": "Measurable outcome: baseline, target, timeframe, who measures it.",
  "dependsOn": [{ "id": "sup-01", "type": "hard", "note": "Why. Types: hard, soft, external" }],
  "openItems": ["Unresolved questions or risks"],
  "impact": 3,
  "effort": 3,
  "status": "Scoping",
  "docUrl": "https://docs.google.com/..."
}`;

/* ---------- api (backed by the team Google Sheet via /api/projects) ---------- */
function getEditKey() {
  try { return localStorage.getItem("portfolio_edit_key") || ""; } catch { return ""; }
}
function storeEditKey(k) {
  try { localStorage.setItem("portfolio_edit_key", k); } catch {}
}

async function apiWrite(method, payload) {
  const send = (key) =>
    fetch("/api/projects", {
      method,
      headers: { "Content-Type": "application/json", ...(key ? { "x-edit-key": key } : {}) },
      body: JSON.stringify(payload),
    });
  let res = await send(getEditKey());
  if (res.status === 401) {
    const k = window.prompt("Editing is protected. Enter the team edit key:");
    if (!k) throw new Error("Edit key required");
    storeEditKey(k);
    res = await send(k);
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ---------- small atoms ---------- */
function Eyebrow({ children, color }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        fontWeight: 600,
        color: color || T.inkSoft,
      }}
    >
      {children}
    </span>
  );
}

function Chip({ children, bg, fg, border }) {
  return (
    <span
      style={{
        fontFamily: T.body,
        fontSize: 11.5,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: 999,
        background: bg || T.hairlineSoft,
        color: fg || T.ink,
        border: border ? `1px solid ${border}` : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ScoreDots({ value, color }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: n <= value ? color : T.hairline,
          }}
        />
      ))}
    </span>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [view, setView] = useState("board");
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [wsFilter, setWsFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  const refresh = async () => {
    try {
      setLoadError("");
      const r = await fetch("/api/projects");
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `API error (${r.status})`);
      }
      setProjects(await r.json());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { refresh(); }, []);

  const byId = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const visible = wsFilter === "All" ? projects : projects.filter((p) => p.workstream === wsFilter);
  const selected = selectedId ? byId[selectedId] : null;

  const updateProject = async (id, patch) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      await apiWrite("PATCH", { id, ...patch });
    } catch (e) {
      window.alert(`Couldn't save to the sheet: ${e.message}`);
      refresh();
    }
  };

  const addProject = async (proj) => {
    await apiWrite("POST", proj);
    await refresh();
  };

  const removeProject = async (id) => {
    if (!window.confirm("Remove this project from the portfolio and the Google Sheet?")) return;
    try {
      await apiWrite("DELETE", { id });
      setSelectedId(null);
      await refresh();
    } catch (e) {
      window.alert(`Couldn't remove: ${e.message}`);
    }
  };

  const dependents = (id) => projects.filter((p) => (p.dependsOn || []).some((d) => d.id === id));

  const workstreams = ["All", ...Array.from(new Set(projects.map((p) => p.workstream)))];

  const views = [
    ["board", "Board"],
    ["matrix", "Priority matrix"],
    ["sequence", "Sequence"],
    ["people", "People & load"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: T.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        button:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${T.ink}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      {/* header */}
      <header
        style={{
          padding: "26px 28px 0",
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Eyebrow>MOXIE · REVOPS · {projects.length} PROJECTS</Eyebrow>
            <h1
              style={{
                fontFamily: T.display,
                fontWeight: 800,
                fontSize: 34,
                lineHeight: 1.05,
                margin: "6px 0 0",
                letterSpacing: "-0.02em",
              }}
            >
              Project Portfolio
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: T.inkSoft, maxWidth: 560 }}>
              Live from the team Google Sheet — scores, statuses, and new projects save back for everyone.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={refresh}
              title="Pull the latest from the Google Sheet"
              style={{
                fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "8px 14px",
                borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink,
              }}
            >
              ↻ Sync
            </button>
            <button
              onClick={() => setShowGlossary(true)}
              style={{
                fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "8px 14px",
                borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink,
              }}
            >
              Glossary
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "8px 14px",
                borderRadius: 8, border: "none", background: T.ink, color: "#fff",
              }}
            >
              + Add project
            </button>
          </div>
        </div>

        {/* nav + filter */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 12, marginTop: 22, borderBottom: `1px solid ${T.hairline}`, paddingBottom: 0,
          }}
        >
          <nav style={{ display: "flex", gap: 2 }}>
            {views.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                style={{
                  fontFamily: T.body, fontSize: 13.5, fontWeight: view === key ? 600 : 500,
                  padding: "10px 14px", background: "none", border: "none",
                  color: view === key ? T.ink : T.inkSoft,
                  borderBottom: view === key ? `2px solid ${T.ink}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 6, paddingBottom: 8, flexWrap: "wrap" }}>
            {workstreams.map((w) => {
              const meta = WS[w] || WS.Other;
              const active = wsFilter === w;
              return (
                <button
                  key={w}
                  onClick={() => setWsFilter(w)}
                  style={{
                    fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "5px 11px",
                    borderRadius: 999,
                    border: `1px solid ${active ? (w === "All" ? T.ink : meta.color) : T.hairline}`,
                    background: active ? (w === "All" ? T.ink : meta.soft) : T.surface,
                    color: active ? (w === "All" ? "#fff" : meta.color) : T.inkSoft,
                  }}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 28px 60px" }}>
        {!loaded ? (
          <p style={{ color: T.inkSoft, fontSize: 14 }}>Loading from the team Google Sheet…</p>
        ) : loadError ? (
          <div style={{ background: "#FBEAEA", border: "1px solid #E3B9B9", borderRadius: 12, padding: 20, maxWidth: 560 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#A33D3D" }}>Couldn't reach the Google Sheet</p>
            <p style={{ margin: "6px 0 12px", fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{loadError}. Check the Vercel environment variables and that the sheet is shared with the service account.</p>
            <button onClick={refresh} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "none", background: T.ink, color: "#fff" }}>Try again</button>
          </div>
        ) : view === "board" ? (
          <Board projects={visible} onOpen={setSelectedId} />
        ) : view === "matrix" ? (
          <Matrix projects={visible} onOpen={setSelectedId} />
        ) : view === "sequence" ? (
          <Sequence projects={visible} byId={byId} onOpen={setSelectedId} />
        ) : (
          <People projects={visible} onOpen={setSelectedId} />
        )}
      </main>

      {selected && (
        <Detail
          p={selected}
          byId={byId}
          dependents={dependents(selected.id)}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateProject(selected.id, patch)}
          onRemove={() => removeProject(selected.id)}
          onOpen={setSelectedId}
        />
      )}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addProject} existing={projects} />}
      {showGlossary && <GlossaryModal onClose={() => setShowGlossary(false)} />}
    </div>
  );
}

/* ---------- BOARD ---------- */
function Board({ projects, onOpen }) {
  if (!projects.length) return <Empty />;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
        gap: 14,
      }}
    >
      {projects.map((p) => {
        const ws = WS[p.workstream] || WS.Other;
        const tbd = (p.contractors || []).filter((c) => c.status === "TBD").length;
        return (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            style={{
              textAlign: "left", background: T.surface, border: `1px solid ${T.hairline}`,
              borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10,
              borderTop: `3px solid ${ws.color}`, transition: "box-shadow .15s, transform .15s",
              fontFamily: T.body,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 18px rgba(28,37,33,.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={ws.color}>{p.code}</Eyebrow>
              <Chip bg={statusBg(p.status)} fg={statusFg(p.status)}>{p.status}</Chip>
            </div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17.5, lineHeight: 1.2, letterSpacing: "-0.01em", color: T.ink }}>
              {p.title}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: T.inkSoft, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {p.problem}
            </p>
            <div style={{ display: "flex", gap: 18, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: T.inkSoft }}>
                Impact&nbsp;&nbsp;<ScoreDots value={p.impact} color={ws.color} />
              </span>
              <span style={{ fontSize: 11, color: T.inkSoft }}>
                Effort&nbsp;&nbsp;<ScoreDots value={p.effort} color={T.ink} />
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {(p.dependsOn || []).map((d, i) => (
                <Chip key={i} bg={d.type === "hard" ? "#FBEAEA" : d.type === "external" ? "#FFF3DD" : T.hairlineSoft}
                  fg={d.type === "hard" ? "#A33D3D" : d.type === "external" ? "#9A6A12" : T.inkSoft}>
                  {d.type === "external" ? "⚑ external gate" : `${d.type === "hard" ? "needs" : "boosted by"} ${(d.id || "").toUpperCase()}`}
                </Chip>
              ))}
              {tbd > 0 && <Chip bg="#FBEAEA" fg="#A33D3D">{tbd} contractor TBD</Chip>}
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

  // offset overlapping points
  const seen = {};
  const pts = projects.map((p) => {
    const key = `${p.effort}-${p.impact}`;
    const n = seen[key] || 0;
    seen[key] = n + 1;
    return { p, dx: (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 26, dy: n * 6 };
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={h2Style}>Impact vs. effort</h2>
        <span style={{ fontSize: 12, color: T.inkSoft }}>Scores are RevOps draft estimates — open any project to adjust. Dot color = workstream.</span>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 10, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 640, display: "block" }} role="img" aria-label="Impact versus effort matrix">
          {/* quadrant shading */}
          <rect x={PAD} y={30} width={(W - PAD - 20) / 2} height={(H - PAD - 30) / 2} fill="#EDF6F0" rx={8} />
          {/* grid */}
          {[1, 2, 3, 4, 5].map((n) => (
            <g key={n}>
              <line x1={x(n)} y1={30} x2={x(n)} y2={H - PAD} stroke={T.hairlineSoft} />
              <line x1={PAD} y1={y(n)} x2={W - 20} y2={y(n)} stroke={T.hairlineSoft} />
              <text x={x(n)} y={H - PAD + 20} textAnchor="middle" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{n}</text>
              <text x={PAD - 14} y={y(n) + 4} textAnchor="end" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{n}</text>
            </g>
          ))}
          {/* mid lines */}
          <line x1={x(3)} y1={30} x2={x(3)} y2={H - PAD} stroke={T.hairline} strokeDasharray="4 4" />
          <line x1={PAD} y1={y(3)} x2={W - 20} y2={y(3)} stroke={T.hairline} strokeDasharray="4 4" />
          {/* quadrant labels */}
          <text x={PAD + 12} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#0E8A74" letterSpacing="1">QUICK WINS</text>
          <text x={W - 32} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.inkSoft} letterSpacing="1" textAnchor="end">BIG BETS</text>
          <text x={PAD + 12} y={H - PAD - 12} fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.inkSoft} letterSpacing="1">FILL-INS</text>
          <text x={W - 32} y={H - PAD - 12} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#A33D3D" letterSpacing="1" textAnchor="end">QUESTION THESE</text>
          {/* axes labels */}
          <text x={(PAD + W - 20) / 2} y={H - 10} textAnchor="middle" fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600">Effort →</text>
          <text x={16} y={(30 + H - PAD) / 2} fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600" transform={`rotate(-90 16 ${(30 + H - PAD) / 2})`} textAnchor="middle">Impact →</text>
          {/* points */}
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
  );
}

/* ---------- SEQUENCE ---------- */
function Sequence({ projects, byId, onOpen }) {
  if (!projects.length) return <Empty />;
  // level = longest hard-dependency chain
  const level = (p, depth = 0) => {
    if (depth > 6) return 0;
    const hard = (p.dependsOn || []).filter((d) => d.type === "hard" && byId[d.id]);
    if (!hard.length) return 0;
    return 1 + Math.max(...hard.map((d) => level(byId[d.id], depth + 1)));
  };
  const cols = [[], [], []];
  projects.forEach((p) => cols[Math.min(level(p), 2)].push(p));
  const colTitles = ["Foundations — no hard prerequisites", "Unlocked next", "Later"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={h2Style}>Sequencing by dependency</h2>
        <span style={{ fontSize: 12, color: T.inkSoft }}>
          <strong style={{ color: "#A33D3D" }}>needs</strong> = hard prerequisite · <strong>boosted by</strong> = better together, not blocking · <strong style={{ color: "#9A6A12" }}>⚑</strong> = gated outside this portfolio
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {cols.map((col, i) =>
          col.length === 0 && i === 2 ? null : (
            <div key={i} style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <Eyebrow>{`PHASE ${i + 1}`}</Eyebrow>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{colTitles[i]}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.map((p) => {
                  const ws = WS[p.workstream] || WS.Other;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onOpen(p.id)}
                      style={{
                        textAlign: "left", background: T.surface, border: `1px solid ${T.hairline}`,
                        borderLeft: `3px solid ${ws.color}`, borderRadius: 10, padding: "12px 14px",
                        fontFamily: T.body,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <Eyebrow color={ws.color}>{p.code}</Eyebrow>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: T.ink }}>{p.title}</span>
                      </div>
                      {(p.dependsOn || []).length > 0 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                          {p.dependsOn.map((d, j) => (
                            <Chip key={j}
                              bg={d.type === "hard" ? "#FBEAEA" : d.type === "external" ? "#FFF3DD" : T.hairlineSoft}
                              fg={d.type === "hard" ? "#A33D3D" : d.type === "external" ? "#9A6A12" : T.inkSoft}>
                              {d.type === "external" ? "⚑ " + d.note : `${d.type === "hard" ? "needs" : "boosted by"} ${(d.id || "").toUpperCase()}`}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
                {col.length === 0 && <p style={{ fontSize: 12.5, color: T.inkSoft, margin: 0 }}>Nothing here yet.</p>}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ---------- PEOPLE ---------- */
function People({ projects, onOpen }) {
  if (!projects.length) return <Empty />;
  // collect all resources: teams + contractors
  const resources = [];
  const add = (name, kind) => {
    if (!resources.find((r) => r.name === name)) resources.push({ name, kind });
  };
  projects.forEach((p) => {
    (p.teams || []).forEach((t) => add(t, "team"));
    (p.contractors || []).forEach((c) => add(c.name, "contractor"));
  });
  resources.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "contractor" ? -1 : 1));

  const involved = (r, p) =>
    r.kind === "team"
      ? (p.teams || []).includes(r.name)
      : (p.contractors || []).find((c) => c.name === r.name);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={h2Style}>Who's load-bearing</h2>
        <span style={{ fontSize: 12, color: T.inkSoft }}>Red = contractor still unsourced. A crowded row is a sequencing constraint.</span>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720, fontFamily: T.body }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 190 }}>Resource</th>
              {projects.map((p) => {
                const ws = WS[p.workstream] || WS.Other;
                return (
                  <th key={p.id} style={{ ...thStyle, color: ws.color }}>
                    <button onClick={() => onOpen(p.id)} style={{ background: "none", border: "none", color: ws.color, fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>
                      {p.code}
                    </button>
                  </th>
                );
              })}
              <th style={thStyle}>Load</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => {
              const hits = projects.filter((p) => involved(r, p));
              const anyTbd = r.kind === "contractor" && hits.some((p) => (p.contractors || []).find((c) => c.name === r.name && c.status === "TBD"));
              return (
                <tr key={r.name} style={{ borderTop: `1px solid ${T.hairlineSoft}` }}>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: anyTbd ? "#A33D3D" : T.ink }}>{r.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: T.inkSoft }}>
                      {r.kind === "contractor" ? (anyTbd ? "contractor · unsourced" : "contractor") : "team"}
                    </span>
                  </td>
                  {projects.map((p) => {
                    const hit = involved(r, p);
                    const tbd = hit && r.kind === "contractor" && hit.status === "TBD";
                    return (
                      <td key={p.id} style={{ textAlign: "center", padding: "10px 6px" }}>
                        {hit ? (
                          <span
                            title={r.kind === "contractor" ? hit.scope : undefined}
                            style={{
                              display: "inline-block", width: 12, height: 12, borderRadius: tbd ? 3 : 999,
                              background: tbd ? "#C75050" : (WS[p.workstream] || WS.Other).color,
                            }}
                          />
                        ) : null}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: hits.length >= 4 ? "#A33D3D" : T.inkSoft }}>
                    {hits.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- DETAIL DRAWER ---------- */
function Detail({ p, byId, dependents, onClose, onUpdate, onRemove, onOpen }) {
  const ws = WS[p.workstream] || WS.Other;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 50,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", height: "100%", background: T.surface, overflowY: "auto",
          boxShadow: "-12px 0 40px rgba(28,37,33,.18)", fontFamily: T.body,
        }}
      >
        <div style={{ padding: "22px 26px", borderBottom: `1px solid ${T.hairline}`, position: "sticky", top: 0, background: T.surface, zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Eyebrow color={ws.color}>{p.code}</Eyebrow>
                <Chip bg={ws.soft} fg={ws.color}>{p.workstream}</Chip>
              </div>
              <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 24, margin: "8px 0 0", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {p.title}
              </h2>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 8, width: 32, height: 32, fontSize: 16, color: T.inkSoft, flexShrink: 0 }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: "20px 26px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* editable scoring strip */}
          <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: 14, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <LabeledSelect label="Impact" value={p.impact} options={[1, 2, 3, 4, 5]} onChange={(v) => onUpdate({ impact: Number(v) })} />
            <LabeledSelect label="Effort" value={p.effort} options={[1, 2, 3, 4, 5]} onChange={(v) => onUpdate({ effort: Number(v) })} />
            <LabeledSelect label="Status" value={p.status} options={STATUSES} onChange={(v) => onUpdate({ status: v })} />
            <span style={{ fontSize: 11, color: T.inkSoft, flexBasis: "100%" }}>Changes save automatically and feed the priority matrix.</span>
          </div>

          <Section title="The problem">{p.problem}</Section>
          <Section title="The proposed solution">{p.solution}</Section>

          <div>
            <SectionTitle>What's being built</SectionTitle>
            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
              {(p.deliverables || []).map((d, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: d.stretch ? 2 : 999, background: d.stretch ? "#C9A24B" : ws.color, marginTop: 6, flexShrink: 0 }} />
                  <span>
                    {d.text}
                    {d.stretch && <Chip bg="#FAF3E0" fg="#8A6914"> stretch — not committed</Chip>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionTitle>Who does what</SectionTitle>
            <div style={{ border: `1px solid ${T.hairline}`, borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
              {(p.roles || []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", borderTop: i ? `1px solid ${T.hairlineSoft}` : "none", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, minWidth: 150, flexShrink: 0 }}>{r.who}</span>
                  <span style={{ color: T.inkSoft, lineHeight: 1.45 }}>{r.what}</span>
                </div>
              ))}
            </div>
          </div>

          <Section title="Definition of success">{p.success}</Section>

          {(p.dependsOn || []).length > 0 && (
            <div>
              <SectionTitle>Depends on</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {p.dependsOn.map((d, i) => {
                  const dep = byId[d.id];
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 }}>
                      <Chip
                        bg={d.type === "hard" ? "#FBEAEA" : d.type === "external" ? "#FFF3DD" : T.hairlineSoft}
                        fg={d.type === "hard" ? "#A33D3D" : d.type === "external" ? "#9A6A12" : T.inkSoft}>
                        {d.type}
                      </Chip>
                      {dep ? (
                        <button onClick={() => onOpen(dep.id)} style={{ background: "none", border: "none", fontWeight: 600, color: T.ink, fontSize: 13, textDecoration: "underline", padding: 0, fontFamily: T.body }}>
                          {dep.code} — {dep.title}
                        </button>
                      ) : (
                        <span style={{ fontWeight: 600 }}>Outside this portfolio</span>
                      )}
                      <span style={{ color: T.inkSoft }}>{d.note}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dependents.length > 0 && (
            <div>
              <SectionTitle>Unlocks</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {dependents.map((d) => (
                  <button key={d.id} onClick={() => onOpen(d.id)} style={{ background: (WS[d.workstream] || WS.Other).soft, color: (WS[d.workstream] || WS.Other).color, border: "none", borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 600, fontFamily: T.body }}>
                    {d.code} {d.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(p.openItems || []).length > 0 && (
            <div style={{ background: "#FFF8EC", border: "1px solid #EFDFBC", borderRadius: 10, padding: "12px 16px" }}>
              <SectionTitle>Open items before this can be prioritized cleanly</SectionTitle>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#6E5612" }}>
                {p.openItems.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", borderTop: `1px solid ${T.hairlineSoft}`, paddingTop: 16, fontSize: 12.5, color: T.inkSoft }}>
            <span><strong style={{ color: T.ink }}>Stakeholder</strong> {p.stakeholder}</span>
            <span><strong style={{ color: T.ink }}>RevOps role</strong> {p.revopsRole}</span>
            <span><strong style={{ color: T.ink }}>Dev resources</strong> {p.devResources || "—"}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {p.docUrl && (
              <a href={p.docUrl} target="_blank" rel="noreferrer"
                style={{ fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 8, background: T.ink, color: "#fff", textDecoration: "none" }}>
                Open one-pager doc ↗
              </a>
            )}
            <button onClick={onRemove} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "9px 14px", borderRadius: 8, background: "none", border: "1px solid #D9A0A0", color: "#A33D3D" }}>
              Remove project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- ADD MODAL ---------- */
function AddModal({ onClose, onAdd, existing }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    try {
      const obj = JSON.parse(text);
      if (!obj.id || !obj.title || !obj.workstream) {
        setErr("Needs at least id, title, and workstream.");
        return;
      }
      if (existing.some((p) => p.id === obj.id)) {
        setErr(`A project with id "${obj.id}" already exists — pick a new code.`);
        return;
      }
      obj.code = obj.code || obj.id.toUpperCase();
      obj.impact = obj.impact || 3;
      obj.effort = obj.effort || 3;
      obj.status = obj.status || "Scoping";
      onAdd(obj)
        .then(() => onClose())
        .catch((e) => setErr(e.message));
    } catch {
      setErr("That isn't valid JSON — check for trailing commas or missing quotes.");
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <h2 style={{ ...h2Style, marginTop: 0 }}>Add a project</h2>
        <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "6px 0 14px" }}>
          Paste a one-pager as JSON. Give the schema below to the AI agent that drafts your one-pagers so each new doc arrives app-ready. New projects persist in this app's storage.
        </p>
        <button
          onClick={() => { setText(TEMPLATE_JSON); setErr(""); }}
          style={{ fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.paper, color: T.ink, marginBottom: 10 }}
        >
          Load schema template
        </button>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(""); }}
          placeholder='{ "id": "spt-01", "title": "...", "workstream": "Support", ... }'
          style={{ width: "100%", height: 260, fontFamily: T.mono, fontSize: 12, lineHeight: 1.55, padding: 14, borderRadius: 10, border: `1px solid ${T.hairline}`, background: T.paper, color: T.ink, resize: "vertical" }}
        />
        {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={submit} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 8, border: "none", background: T.ink, color: "#fff" }}>
            Add to portfolio
          </button>
          <button onClick={onClose} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "9px 16px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- GLOSSARY ---------- */
function GlossaryModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(620px, 100%)", maxHeight: "84vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ ...h2Style, margin: 0 }}>Glossary</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 8, width: 30, height: 30, color: T.inkSoft }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "6px 0 14px" }}>Plain-language definitions so every stakeholder reads the same one-pager.</p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {GLOSSARY.map(([term, def], i) => (
            <div key={term} style={{ display: "flex", gap: 14, padding: "10px 0", borderTop: i ? `1px solid ${T.hairlineSoft}` : "none" }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, minWidth: 150, color: T.ink }}>{term}</span>
              <span style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
const h2Style = { fontFamily: T.display, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", margin: 0, color: T.ink };
const thStyle = { padding: "12px 8px", fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: T.inkSoft, textAlign: "center", background: T.paper };

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkSoft }}>
      {children}
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.62, color: T.ink }}>{children}</p>
    </div>
  );
}
function LabeledSelect({ label, value, options, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: T.ink, fontFamily: T.body }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: T.body, fontSize: 13, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function statusBg(s) {
  return { Scoping: "#EBEFF1", Proposed: "#EFEAFB", Approved: "#E4F3EF", "In flight": "#E0F0FA", Blocked: "#FBEAEA", Done: "#E8F5E2" }[s] || T.hairlineSoft;
}
function statusFg(s) {
  return { Scoping: "#54616B", Proposed: "#6A4FD8", Approved: "#0E8A74", "In flight": "#2371A8", Blocked: "#A33D3D", Done: "#3D7A2E" }[s] || T.inkSoft;
}
function Empty() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkSoft, fontSize: 14 }}>
      No projects here yet. If you just deployed, run the seed step from the README to load the 8 one-pagers — or add one with the button above.
    </div>
  );
}
