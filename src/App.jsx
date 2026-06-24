import { useState, useEffect, useMemo, useRef } from "react";

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

/* known workstreams keep a code prefix; every workstream (known or new) draws its COLOR
   from one well-separated categorical palette so no two ever look alike. */
const WS = {
  "Marketing Services": { code: "MKS" },
  "Supplies": { code: "SUP" },
  "Practice Ops": { code: "POP" },
  "Practice Success": { code: "PRS" },
  "Support": { code: "SPT" },
};
// curated, mutually-distinct, mid-tone (readable as text) categorical palette
const WS_PALETTE = ["#3B6EA5", "#C8732B", "#C0453F", "#2E8B70", "#4F8A3D", "#B08A1E", "#8A5FA8", "#C75D8A", "#8A6A4F", "#5B7185"];
const OTHER_META = { color: "#8A8F98", soft: "#8A8F9822", code: "OTH" };
const wsColorCache = {};
let wsColorN = 0;
function wsPrefix(name) {
  if (!name) return "OTH";
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "OTH";
}
function wsMeta(name) {
  if (!name || name === "Other") return OTHER_META;
  if (!wsColorCache[name]) {
    const color = WS_PALETTE[wsColorN % WS_PALETTE.length];
    wsColorN += 1;
    wsColorCache[name] = { color, soft: color + "22", code: (WS[name] && WS[name].code) || wsPrefix(name) };
  }
  return wsColorCache[name];
}
function genCode(ws, usedCodes) {
  const pre = wsMeta(ws).code;
  let n = 1, c;
  do { c = `${pre}-${String(n).padStart(2, "0")}`; n++; } while (usedCodes.has(c));
  usedCodes.add(c);
  return c;
}
function nextCode(ws, projects, selfId) {
  const used = new Set(projects.filter((p) => p.id !== selfId).map((p) => p.code));
  return genCode(ws, used);
}

/* effort = single cost measure, XS–XL = 1–5 work units */
const EFFORTS = ["XS", "S", "M", "L", "XL"];
const EFFORT_POINTS = { XS: 1, S: 2, M: 3, L: 4, XL: 5 };
// resourcing runs on hours; each effort size maps to an hour estimate
const EFFORT_HOURS = { XS: 10, S: 20, M: 40, L: 60, XL: 80 };
// map an arbitrary hour figure back to the nearest size bucket (timeline CSV uses hours)
function hoursToEffort(h) { const n = Number(h); if (!n) return ""; let best = "M", bd = Infinity; for (const e of EFFORTS) { const d = Math.abs(EFFORT_HOURS[e] - n); if (d < bd) { bd = d; best = e; } } return best; }
const EFFORT_LABEL = { XS: "Extra-small", S: "Small", M: "Medium", L: "Large", XL: "Extra-large" };
/* traffic-light scale: low effort = green, high effort = red */
const EFFORT_COLOR = {
  XS: { soft: "#E3F4E8", color: "#1E8A4C" },
  S:  { soft: "#E9F4DC", color: "#5C8A23" },
  M:  { soft: "#FBF1D6", color: "#B0860F" },
  L:  { soft: "#FBE6D4", color: "#C5651C" },
  XL: { soft: "#FADCDC", color: "#C13434" },
};
/* impact scale 1–5, color-coded (high impact = green, low = red) */
const IMPACT_COLOR = {
  5: { soft: "#E3F4E8", color: "#1E8A4C" },
  4: { soft: "#E9F4DC", color: "#5C8A23" },
  3: { soft: "#FBF1D6", color: "#B0860F" },
  2: { soft: "#FBE6D4", color: "#C5651C" },
  1: { soft: "#FADCDC", color: "#C13434" },
};
/* deliverable type: required (committed) vs optional (stretch) */
const DELIV_TYPE = {
  required: { color: "#1E8A4C", soft: "#E3F4E8", label: "Required" },
  optional: { color: "#C28A12", soft: "#FBF1D6", label: "Optional (stretch)" },
};
const delivType = (stretch) => (stretch ? DELIV_TYPE.optional : DELIV_TYPE.required);
const DEFAULT_CAP = 80; // hours per team per quarter (editable)
// comparative traffic-light heatmap: relative to the grid max, light load = green, mid = amber, heavy = red
function heatStyle(v, max) {
  if (!v) return null;
  const t = max > 0 ? v / max : 0;
  const c = t > 0.66 ? { bg: "#C13434", fg: "#fff" } : t > 0.33 ? { bg: "#E0A21A", fg: "#3A2C05" } : { bg: "#2E8B57", fg: "#fff" };
  return { background: c.bg, color: c.fg };
}
// vs-capacity traffic light: green = comfortably under, amber = near (>75%), red = over capacity
function capHeatStyle(v, cap) {
  if (!v) return null;
  const r = cap > 0 ? v / cap : 1;
  const c = r > 1 ? { bg: "#C13434", fg: "#fff" } : r > 0.75 ? { bg: "#E0A21A", fg: "#3A2C05" } : { bg: "#2E8B57", fg: "#fff" };
  return { background: c.bg, color: c.fg };
}
const TARGETS = ["TBD", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"];
const QUARTERS = TARGETS.filter((t) => t !== "TBD");
function targetRank(t) {
  if (!t || t.toUpperCase() === "TBD") return 999999;
  let m = t.match(/Q([1-4])\s*(\d{4})/i); if (m) return (+m[2]) * 10 + (+m[1]);
  m = t.match(/H([12])\s*(\d{4})/i); if (m) return (+m[2]) * 10 + (+m[1] === 1 ? 2 : 4);
  m = t.match(/^\s*(\d{4})\s*$/); if (m) return (+m[1]) * 10 + 5;
  return 999998;
}

/* ---------- default resourcing taxonomy (editable + persisted in settings.org) ---------- */
const DEFAULT_ORG = [
  {
    name: "RevOps",
    members: [
      { name: "Pre-Sales", lead: "Addison Huneycutt" },
      { name: "Post-Sales", lead: "New Hire" },
      { name: "Business Systems", lead: "Will Liao" },
    ],
  },
  {
    name: "Contractors",
    members: [
      { name: "HubSpot", lead: "Empty Cup Digital" },
      { name: "Arrows", lead: "LeanLayer" },
      { name: "ClickUp", lead: "New Contractor" },
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
      { name: "AI & Automation", lead: "Ankita Avadhani" },
    ],
  },
  { name: "Data", members: [{ name: "Data", lead: "Josh Malarkey" }] },
  { name: "Engineering", members: [{ name: "Engineering", lead: "Ryan Burbank" }] },
  {
    name: "Customer Growth",
    members: [
      { name: "Practice Success", lead: "Sarah Thaler", pm: "New Hire PM" },
      {
        name: "Practice Ops", lead: "Miki Lager", pm: "Jennifer Denton",
        sub: [
          { name: "Supplies", lead: "Shannon Aubert" },
          { name: "Onboarding", lead: "Leslie Nichols" },
          { name: "MD Ops", lead: "Ashley Pope" },
          { name: "Financial Services", lead: "Jennifer Denton" },
          { name: "Migrations", lead: "Amira Aldewick" },
        ],
      },
      {
        name: "Marketing Services", lead: "Johanna Singer", pm: "Christina Robichaux",
        sub: [
          { name: "Paid Media", lead: "Jenn Peterson" },
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
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json", "x-edit-key": getEditKey() }, body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error("Editing is locked. Unlock with the password to make changes.");
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Request failed (${res.status})`); }
  return res.json();
}

/* ---------- resourcing helpers ---------- */
/* A team is allocated to a project purely when the project names that team
   (or its lead) in its Team & resourcing list. */
function normName(s) { return (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/ team$/, ""); }
function normDel(s) { return (s || "").toLowerCase().trim().replace(/\s+/g, " "); }
function resourceNames(resource) { return new Set([normName(resource.label), normName(resource.lead)].filter(Boolean)); }
function matchesResource(resource, who) { return resourceNames(resource).has(normName(who)); }
function roleEffort(r) { return EFFORT_HOURS[r && r.effort] || EFFORT_HOURS.M; }
function quarterOf(start) { const idx = parseStart(start); return idx == null ? "TBD" : weekLabel(idx).q; }
// A project's work assignments drive Resourcing. If it has a scheduled timeline (Gantt), those
// tasks — owner + effort + the quarter each runs in — are the source of truth; otherwise fall
// back to the Team & resourcing roles (project's target quarter).
function projectAssignments(p) {
  if ((p.schedule || []).length) return p.schedule.map((t) => ({ owner: t.owner || "", pts: EFFORT_HOURS[t.effort] || EFFORT_HOURS.M, quarter: quarterOf(t.start) }));
  return (p.roles || []).map((r) => ({ owner: r.who || "", pts: roleEffort(r), quarter: p.targetWindow || "TBD" }));
}
function resourceProjects(resource, projects) { return projects.filter((p) => projectAssignments(p).some((a) => matchesResource(resource, a.owner))); }
function resourceUnitsOn(resource, p) { return projectAssignments(p).filter((a) => matchesResource(resource, a.owner)).reduce((s, a) => s + a.pts, 0); }
function projectLoad(p) { return EFFORT_POINTS[p.effort] || EFFORT_POINTS.M; }
function codeNum(p) { const m = (p.code || "").match(/(\d+)/); return m ? Number(m[1]) : 9999; }
// default ordering: by category (workstream) A→Z, then by the numeric part of the project code
function byCategoryThenNumber(a, b) { return (a.workstream || "").localeCompare(b.workstream || "") || codeNum(a) - codeNum(b) || (a.code || "").localeCompare(b.code || ""); }
function resolveResource(org, who) { const n = normName(who); return allResources(org).find((r) => normName(r.label) === n || normName(r.lead) === n) || null; }
function resourcePath(org, who) { const r = resolveResource(org, who); return r ? [r.group, r.label, r.lead].filter(Boolean).join(" · ") : who; }
// like resourcePath, but appends "· PM <name>" when the resource has a project manager (used in the timeline)
function resourcePathPM(org, who) { const r = resolveResource(org, who); if (!r) return who; const base = [r.group, r.label, r.lead].filter(Boolean).join(" · "); return r.pm ? `${base} · PM ${r.pm}` : base; }
// owner split for the timeline: team identity on one line, the people (lead + PM) on the next
function resourceLines(org, who) {
  const r = resolveResource(org, who);
  if (!r) return { team: who, people: "" };
  return { team: [r.group, r.label].filter(Boolean).join(" · "), people: [r.lead, r.pm ? `PM ${r.pm}` : ""].filter(Boolean).join(" · ") };
}
function allResources(org) {
  const out = [];
  (org || []).forEach((g) => {
    (g.members || []).forEach((m) => {
      if (m.sub) { out.push({ group: g.name, label: m.name, lead: m.lead, pm: m.pm, cap: m.cap }); (m.sub || []).forEach((s) => out.push({ group: g.name, label: s.name, parent: m.name, lead: s.lead, pm: s.pm, cap: s.cap })); }
      else out.push({ group: g.name, label: m.name, lead: m.lead, pm: m.pm, cap: m.cap });
    });
  });
  return out;
}

/* ---------- atoms ---------- */
// render plain text but turn any http(s):// or www. URL into a clickable link (trailing punctuation kept outside the link)
function Linkify({ children }) {
  const text = children == null ? "" : String(children);
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
  return parts.map((part, i) => {
    if (!/^(https?:\/\/|www\.)/i.test(part)) return part;
    const m = part.match(/[.,;:!?)\]}>"']+$/);
    const trail = m ? m[0] : "";
    const url = trail ? part.slice(0, -trail.length) : part;
    const href = url.startsWith("http") ? url : "https://" + url;
    return <span key={i}><a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#2C6BAE", textDecoration: "underline", wordBreak: "break-word" }}>{url}</a>{trail}</span>;
  });
}
function Eyebrow({ children, color }) { return <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: color || T.inkSoft }}>{children}</span>; }
function Chip({ children, bg, fg }) { return <span style={{ fontFamily: T.body, fontSize: 11.5, fontWeight: 500, padding: "3px 9px", borderRadius: 999, background: bg || T.hairlineSoft, color: fg || T.ink, whiteSpace: "nowrap" }}>{children}</span>; }
function ScoreDots({ value, color }) {
  return <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ width: 7, height: 7, borderRadius: 999, background: n <= value ? color : T.hairline }} />)}</span>;
}
function EffortChip({ effort }) {
  const e = effort || "M"; const c = EFFORT_COLOR[e] || EFFORT_COLOR.M;
  return <span title={`${EFFORT_LABEL[e]} · ${EFFORT_POINTS[e]}/5 work units`} style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: c.soft, color: c.color, letterSpacing: "0.04em" }}>{e}</span>;
}
function GanttLegend() {
  const dot = (c) => ({ width: 9, height: 9, borderRadius: 3, background: c, flexShrink: 0 });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", alignItems: "center", fontFamily: T.body, fontSize: 11.5, color: T.inkSoft }}>
      <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.06em" }}>DELIVERABLE</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={dot(DELIV_TYPE.required.color)} />{DELIV_TYPE.required.label}</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={dot(DELIV_TYPE.optional.color)} />{DELIV_TYPE.optional.label}</span>
      </span>
    </div>
  );
}
function ImpactChip({ impact }) {
  const i = impact || 3; const c = IMPACT_COLOR[i] || IMPACT_COLOR[3];
  return <span title={`Impact ${i}/5`} style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: c.soft, color: c.color, letterSpacing: "0.04em" }}>Imp {i}</span>;
}
function initials(name) { return (name || "").split(/[\s·]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function Avatar({ name, color }) { return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 999, background: (color || T.inkSoft) + "22", color: color || T.inkSoft, fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</span>; }

function WorkstreamSelect({ value, options, onChange, color }) {
  const opts = Array.from(new Set([value, ...options].filter(Boolean)));
  return (
    <select value={value || ""} onChange={(e) => { if (e.target.value === "__new__") { const v = window.prompt("New workstream name:"); if (v && v.trim()) onChange(v.trim()); } else onChange(e.target.value); }}
      style={{ fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "3px 7px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: color || T.ink }}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__new__">+ New workstream…</option>
    </select>
  );
}

/* ---------- main app ---------- */
const CACHE_KEY = "revops:data:v2"; // v2: bumped to discard any stale/divergent v1 cache
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
const writeCache = (d) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* quota/private mode */ } };

export default function App() {
  const [view, setView] = useState("board");
  const [projects, setProjects] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [weeklyCap, setWeeklyCap] = useState({});
  const [org, setOrg] = useState(DEFAULT_ORG);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [wsFilter, setWsFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [needsRestore, setNeedsRestore] = useState(false);
  const [unlocked, setUnlocked] = useState(() => getEditKey() === EDIT_PW);

  const applyState = (data) => {
    setProjects(Array.isArray(data.projects) ? data.projects : []);
    const s = data.settings || {};
    setCapacities(s.capacities || {});
    setWeeklyCap(s.weeklyCap || {});
    setOrg(Array.isArray(s.org) && s.org.length ? s.org : DEFAULT_ORG);
  };
  // mirror the latest rendered state so cache writes can grab the half that didn't change in a mutation
  const stateRef = useRef({ projects: [], settings: {} });
  stateRef.current = { projects, settings: { capacities, weeklyCap, org } };
  // The local cache only ever holds SERVER-CONFIRMED state — never optimistic in-flight edits — so a
  // failed/stale read falls back to what actually persisted, not phantom edits.
  const cacheProjects = (nextProjects) => writeCache({ projects: nextProjects, settings: stateRef.current.settings });
  const cacheSettings = (nextSettings) => writeCache({ projects: stateRef.current.projects, settings: nextSettings });

  // single combined read; falls back to the local cache on any error
  const refresh = async () => {
    try {
      setLoadError("");
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Could not load data (${res.status})`); }
      const data = await res.json();
      const cached = readCache();
      if (!(data.projects || []).length && (cached?.projects || []).length) {
        // server is empty but this browser has a saved copy — keep showing it and offer to restore;
        // crucially do NOT overwrite the local backup with the empty server response
        applyState(cached);
        setNeedsRestore(true);
      } else {
        applyState(data);
        writeCache({ projects: data.projects || [], settings: data.settings || {} });
        setNeedsRestore(false);
      }
    } catch (e) {
      const cached = readCache();
      if (cached) { applyState(cached); setLoadError(""); } else setLoadError(e.message);
    } finally { setLoaded(true); }
  };
  // Restore this browser's cached copy to the (empty) server — recovery path after the Blob outage.
  const restoreFromCache = async () => {
    const cached = readCache();
    if (!cached || !(cached.projects || []).length) return;
    if (getEditKey() !== EDIT_PW) {
      const pw = window.prompt("Enter the edit password to restore this browser's data:");
      if (pw == null) return;
      if (pw !== EDIT_PW) { window.alert("Incorrect password."); return; }
      storeEditKey(pw); setUnlocked(true);
    }
    if (!window.confirm(`Restore ${(cached.projects || []).length} projects from this browser to the server?`)) return;
    try {
      const res = await apiWrite("/api/data", "POST", { projects: cached.projects || [], settings: cached.settings || {} });
      applyState({ projects: res.projects, settings: res.settings });
      writeCache({ projects: res.projects, settings: res.settings });
      setNeedsRestore(false);
      window.alert(`Restored ${(res.projects || []).length} projects.`);
    } catch (e) { window.alert(`Restore failed: ${e.message}`); }
  };
  useEffect(() => {
    const cached = readCache();
    if (cached) { applyState(cached); setLoaded(true); } // instant paint from cache, then revalidate
    refresh();
  }, []);

  const toggleLock = () => {
    if (unlocked) { clearEditKey(); setUnlocked(false); return; }
    const pw = window.prompt("Enter the edit password to unlock editing:");
    if (pw == null) return;
    if (pw === EDIT_PW) { storeEditKey(pw); setUnlocked(true); } else window.alert("Incorrect password.");
  };

  const byId = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const allWorkstreams = useMemo(() => Array.from(new Set([...Object.keys(WS).filter((w) => w !== "Other"), ...projects.map((p) => p.workstream).filter(Boolean)])), [projects]);
  const visible = (wsFilter === "All" ? projects : projects.filter((p) => p.workstream === wsFilter)).slice().sort(byCategoryThenNumber);
  const selected = selectedId ? byId[selectedId] : null;

  const updateProject = async (id, patch) => {
    let full = patch;
    if ("workstream" in patch) full = { ...patch, code: nextCode(patch.workstream, projects, id) };
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...full } : p)));
    try { const res = await apiWrite("/api/projects", "PATCH", { id, ...full }); if (res.projects) { setProjects(res.projects); cacheProjects(res.projects); return res.projects.find((x) => x.id === id) || null; } }
    catch (e) { window.alert(`Couldn't save: ${e.message}`); refresh(); }
    return null;
  };
  const addProject = async (proj) => { const res = await apiWrite("/api/projects", "POST", proj); if (res.projects) { setProjects(res.projects); cacheProjects(res.projects); } else await refresh(); setSelectedId(proj.id); };
  // CSV import: one bulk request applies every create + update in a single read-modify-write
  // (44 sequential round-trips previously timed out / hit rate limits → "Failed to fetch").
  const importProjects = async (creates, updates) => {
    const cleanUpdates = updates.map(({ _code, ...u }) => u);
    const res = await apiWrite("/api/projects", "PUT", { creates, updates: cleanUpdates });
    if (res && res.projects) { setProjects(res.projects); cacheProjects(res.projects); } else await refresh();
    return { created: res.created ?? creates.length, updated: res.updated ?? updates.length };
  };
  const removeProject = async (id) => {
    if (!window.confirm("Remove this project from the portfolio?")) return;
    try { const res = await apiWrite("/api/projects", "DELETE", { id }); setSelectedId(null); if (res.projects) { setProjects(res.projects); cacheProjects(res.projects); } else await refresh(); }
    catch (e) { window.alert(`Couldn't remove: ${e.message}`); }
  };
  const exportCsv = () => {
    const blob = new Blob([projectsToCsv(projects)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "revops-portfolio.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const persistSettings = async (next) => {
    const payload = { capacities: next.capacities ?? capacities, weeklyCap: next.weeklyCap ?? weeklyCap, org: next.org ?? org };
    try { await apiWrite("/api/settings", "PUT", payload); cacheSettings(payload); } catch (e) { window.alert(`Couldn't save: ${e.message}`); refresh(); }
  };
  const setWeekly = (person, value) => { const c = { ...weeklyCap, [person]: value }; setWeeklyCap(c); persistSettings({ weeklyCap: c }); };
  const saveOrg = (nextOrg) => { setOrg(nextOrg); return persistSettings({ org: nextOrg }); };
  const importSchedule = async (text) => {
    const { byProjectId, error, count } = csvToSchedule(text, projects);
    if (error) throw new Error(error);
    let res;
    for (const [id, schedule] of Object.entries(byProjectId)) { res = await apiWrite("/api/projects", "PATCH", { id, schedule }); }
    if (res && res.projects) setProjects(res.projects); else await refresh();
    return count;
  };

  const workstreams = ["All", ...Array.from(new Set(projects.map((p) => p.workstream)))];
  const views = [["board", "Board"], ["matrix", "Priority matrix"], ["sequence", "Sequence"], ["resourcing", "Resourcing"], ["schedule", "Timeline"]];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: T.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        button:focus-visible, select:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid ${T.ink}; outline-offset: 2px; }
        .proj-drawer { width: 100%; }
        .proj-grid { display: flex; flex-direction: column; gap: 16px; }
        @media (min-width: 1080px) {
          .proj-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(420px, 1fr); gap: 24px; align-items: start; }
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={{ padding: "26px 14px 0", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Eyebrow>MOXIE · REVOPS · {projects.length} PROJECTS</Eyebrow>
            <h1 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 34, lineHeight: 1.05, margin: "6px 0 0", letterSpacing: "-0.02em" }}>Project Portfolio</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: T.inkSoft, maxWidth: 560 }}>Scope, priority, sequencing, and resourcing for the RevOps project portfolio — one place.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={toggleLock} title={unlocked ? "Lock editing" : "Unlock editing"} style={btnGhost}>{unlocked ? "🔓 Editing" : "🔒 Locked"}</button>
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
                const meta = w === "All" ? null : wsMeta(w);
                const active = wsFilter === w;
                const count = w === "All" ? projects.length : projects.filter((p) => p.workstream === w).length;
                const fg = active ? (w === "All" ? "#fff" : meta.color) : T.inkSoft;
                return <button key={w} onClick={() => setWsFilter(w)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 999, border: `1px solid ${active ? (w === "All" ? T.ink : meta.color) : T.hairline}`, background: active ? (w === "All" ? T.ink : meta.soft) : T.surface, color: fg }}>{w}<span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, padding: "0 5px", borderRadius: 999, background: active ? (w === "All" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.06)") : T.hairlineSoft, color: fg }}>{count}</span></button>;
              })}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 14px 60px" }}>
        {needsRestore && (
          <div style={{ background: "#FFF8EC", border: "1px solid #E9D08A", borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#6E5612" }}>The server is empty, but this browser has your saved data.</div>
              <div style={{ fontSize: 12.5, color: "#6E5612", lineHeight: 1.5, marginTop: 3 }}>Storage was migrated to a new database. Click restore to push this browser's copy ({(readCache()?.projects || []).length} projects) back to the server. You're viewing that local copy now.</div>
            </div>
            <button onClick={restoreFromCache} style={{ ...btnSolid, background: "#9A6A12" }}>Restore to server</button>
          </div>
        )}
        {!loaded ? <p style={{ color: T.inkSoft, fontSize: 14 }}>Loading…</p>
          : loadError ? (
            <div style={{ background: "#FBEAEA", border: "1px solid #E3B9B9", borderRadius: 12, padding: 20, maxWidth: 560 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#A33D3D" }}>Couldn't load the portfolio</p>
              <p style={{ margin: "6px 0 12px", fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{loadError}</p>
              <button onClick={refresh} style={btnSolid}>Try again</button>
            </div>
          ) : view === "board" ? (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
                <button onClick={exportCsv} disabled={!projects.length} title="Download the whole portfolio as CSV" style={{ ...btnGhost, opacity: projects.length ? 1 : 0.5 }}>↓ Export CSV</button>
                {unlocked && <button onClick={() => setShowAdd(true)} style={btnSolid}>+ Add project</button>}
              </div>
              <Board projects={visible} onOpen={setSelectedId} />
            </>
          )
            : view === "matrix" ? <Matrix projects={visible} onOpen={setSelectedId} />
              : view === "sequence" ? <Sequence projects={visible} byId={byId} onOpen={setSelectedId} />
                : view === "resourcing" ? <Resourcing projects={projects} org={org} capacities={capacities} unlocked={unlocked} onSaveOrg={saveOrg} onOpen={setSelectedId} />
                  : <Schedule projects={projects} org={org} unlocked={unlocked} onImport={importSchedule} onOpen={setSelectedId} />}
      </main>

      {selected && <Detail p={selected} byId={byId} org={org} unlocked={unlocked} workstreams={allWorkstreams} onClose={() => setSelectedId(null)} onUpdate={(patch) => updateProject(selected.id, patch)} onRemove={() => removeProject(selected.id)} onOpen={setSelectedId} />}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={addProject} onImport={importProjects} existing={projects} workstreams={allWorkstreams} />}
    </div>
  );
}

/* ---------- BOARD ---------- */
function Board({ projects, onOpen }) {
  if (!projects.length) return <Empty />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
      {projects.map((p) => {
        const ws = wsMeta(p.workstream);
        return (
          <button key={p.id} onClick={() => onOpen(p.id)} style={{ textAlign: "left", background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10, borderTop: `3px solid ${ws.color}`, transition: "box-shadow .15s", fontFamily: T.body }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 18px rgba(28,37,33,.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={ws.color}>{p.code}</Eyebrow>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Chip bg={ws.soft} fg={ws.color}>{p.workstream}</Chip><EffortChip effort={p.effort} ws={ws} /></div>
            </div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17.5, lineHeight: 1.2, letterSpacing: "-0.01em", color: T.ink }}>{p.title}</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: T.inkSoft, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.problem}</p>
            <div style={{ display: "flex", gap: 18, marginTop: 2, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.inkSoft }}>Impact&nbsp;&nbsp;<ScoreDots value={p.impact} color={ws.color} /></span>
              {p.targetWindow && p.targetWindow !== "TBD" && <span style={{ fontSize: 11, color: T.inkSoft }}>Target&nbsp;&nbsp;<strong style={{ color: T.ink, fontFamily: T.mono, fontSize: 11 }}>{p.targetWindow}</strong></span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- MATRIX (impact vs effort) ---------- */
function Matrix({ projects, onOpen }) {
  const [showDeps, setShowDeps] = useState(true);
  if (!projects.length) return <Empty />;
  const W = 860, H = 560, PAD = 56;
  const x = (u) => PAD + ((u - 0.5) / 5) * (W - PAD - 20);
  const y = (impact) => H - PAD - ((impact - 0.5) / 5) * (H - PAD - 30);
  const seen = {};
  const pts = projects.map((p) => {
    const u = projectLoad(p); const key = `${u}-${p.impact}`; const n = seen[key] || 0; seen[key] = n + 1;
    const dx = (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 26, dy = n * 6;
    return { p, u, dx, dy, cx: x(u) + dx, cy: y(p.impact) + dy };
  });
  const pos = Object.fromEntries(pts.map((t) => [t.p.id, t]));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 18, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <h2 style={h2Style}>Impact vs. effort</h2>
          <button onClick={() => setShowDeps((v) => !v)} title="Toggle dependency rings and arrows" style={{ fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "4px 11px", borderRadius: 999, border: `1px solid ${showDeps ? "#C0463E" : T.hairline}`, background: showDeps ? "#FBE0DE" : T.surface, color: showDeps ? "#A33D3D" : T.inkSoft }}>
            {showDeps ? "◯→ Dependencies shown" : "Dependencies hidden"}
          </button>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 10, overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, display: "block" }} role="img" aria-label="Impact versus effort matrix">
            <defs><marker id="matrixArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#C0463E" /></marker></defs>
            <rect x={PAD} y={30} width={(W - PAD - 20) * (2.5 / 5)} height={(H - PAD - 30) / 2} fill="#EDF6F0" rx={8} />
            {[1, 2, 3, 4, 5].map((n) => (<g key={`y${n}`}><line x1={PAD} y1={y(n)} x2={W - 20} y2={y(n)} stroke={T.hairlineSoft} /><text x={PAD - 14} y={y(n) + 4} textAnchor="end" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{n}</text></g>))}
            {[1, 2, 3, 4, 5].map((u) => (<g key={`x${u}`}><line x1={x(u)} y1={30} x2={x(u)} y2={H - PAD} stroke={T.hairlineSoft} /><text x={x(u)} y={H - PAD + 20} textAnchor="middle" fontSize="11" fill={T.inkSoft} fontFamily={T.mono}>{EFFORTS[u - 1]}</text></g>))}
            <line x1={x(3)} y1={30} x2={x(3)} y2={H - PAD} stroke={T.hairline} strokeDasharray="4 4" />
            <line x1={PAD} y1={y(3)} x2={W - 20} y2={y(3)} stroke={T.hairline} strokeDasharray="4 4" />
            <text x={PAD + 12} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#0E8A74" letterSpacing="1">QUICK WINS</text>
            <text x={W - 32} y={48} fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.inkSoft} letterSpacing="1" textAnchor="end">BIG BETS</text>
            <text x={W - 32} y={H - PAD - 12} fontSize="11" fontFamily={T.mono} fontWeight="600" fill="#A33D3D" letterSpacing="1" textAnchor="end">RECONSIDER</text>
            <text x={(PAD + W - 20) / 2} y={H - 10} textAnchor="middle" fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600">Effort →</text>
            <text x={16} y={(30 + H - PAD) / 2} fontSize="12" fill={T.ink} fontFamily={T.body} fontWeight="600" transform={`rotate(-90 16 ${(30 + H - PAD) / 2})`} textAnchor="middle">Impact →</text>
            {/* dependency arrows: prerequisite → dependent (drawn under the dots) */}
            {showDeps && pts.flatMap(({ p }) => (p.dependsOn || []).map((d, k) => {
              const a = pos[d.id], b = pos[p.id];
              if (!a || !b) return null;
              const vx = b.cx - a.cx, vy = b.cy - a.cy; const len = Math.hypot(vx, vy) || 1; const ux = vx / len, uy = vy / len;
              return <line key={p.id + "-dep" + k} x1={a.cx + ux * 15} y1={a.cy + uy * 15} x2={b.cx - ux * 18} y2={b.cy - uy * 18} stroke="#C0463E" strokeWidth="1.6" opacity="0.75" markerEnd="url(#matrixArrow)" />;
            }))}
            {pts.map(({ p, cx, cy }) => {
              const ws = wsMeta(p.workstream); const dependent = (p.dependsOn || []).length > 0;
              return (
                <g key={p.id} onClick={() => onOpen(p.id)} style={{ cursor: "pointer" }}>
                  <circle cx={cx} cy={cy} r={13} fill={ws.color} opacity="0.92" /><circle cx={cx} cy={cy} r={13} fill="none" stroke="#fff" strokeWidth="2" />
                  {showDeps && dependent && <circle cx={cx} cy={cy} r={17} fill="none" stroke="#C0463E" strokeWidth="2" />}
                  <text x={cx} y={cy - 19} textAnchor="middle" fontSize="11" fontFamily={T.mono} fontWeight="600" fill={T.ink}>{p.code}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 14 }}>
        <SectionTitle>Projects</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px", marginTop: 10 }}>
          {projects.map((p) => {
            const ws = wsMeta(p.workstream);
            return (
              <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: "flex", gap: 9, alignItems: "baseline", textAlign: "left", background: "none", border: "none", padding: "2px 0", fontFamily: T.body, minWidth: 0 }}>
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

/* ---------- SEQUENCE (by target window, dependency arrows) ---------- */
const SEQ_GROUPS = {
  workstream: { label: "Workstream", keyOf: (p) => p.workstream || "Other", order: (ls) => ls, color: (l) => wsMeta(l).color, name: (l) => l },
  effort: { label: "Effort", keyOf: (p) => p.effort || "M", order: (ls) => EFFORTS.filter((e) => ls.includes(e)), color: (l) => (EFFORT_COLOR[l] || EFFORT_COLOR.M).color, name: (l) => `${l} · ${EFFORT_LABEL[l]}` },
  impact: { label: "Impact", keyOf: (p) => p.impact || 3, order: (ls) => [5, 4, 3, 2, 1].filter((i) => ls.includes(i)), color: (l) => (IMPACT_COLOR[l] || IMPACT_COLOR[3]).color, name: (l) => `Impact ${l}` },
};
function Sequence({ projects, byId, onOpen }) {
  const [showDeps, setShowDeps] = useState(true);
  const [groupBy, setGroupBy] = useState("workstream");
  if (!projects.length) return <Empty />;
  const g = SEQ_GROUPS[groupBy];
  const quarters = Array.from(new Set(projects.map((p) => p.targetWindow || "TBD"))).sort((a, b) => targetRank(a) - targetRank(b));
  const qIndex = Object.fromEntries(quarters.map((q, i) => [q, i]));
  const qCount = {}, qImpact = {}, qEffort = {};
  projects.forEach((p) => { const q = p.targetWindow || "TBD"; qCount[q] = (qCount[q] || 0) + 1; qImpact[q] = (qImpact[q] || 0) + (Number(p.impact) || 0); qEffort[q] = (qEffort[q] || 0) + (EFFORT_POINTS[p.effort] || EFFORT_POINTS.M); });
  const laneKeys = []; projects.forEach((p) => { const k = g.keyOf(p); if (!laneKeys.includes(k)) laneKeys.push(k); });
  const lanes = g.order(laneKeys);
  const cell = {}; lanes.forEach((w) => { cell[w] = {}; quarters.forEach((q) => { cell[w][q] = []; }); });
  projects.forEach((p) => cell[g.keyOf(p)][p.targetWindow || "TBD"].push(p));
  const laneOfProj = {}; projects.forEach((p) => { laneOfProj[p.id] = g.keyOf(p); });

  const NODE_W = 170, NODE_H = 90, V_GAP = 12, COL_GAP = 104, TOP = 50, GUTTER = 120, PADY = 14;
  const colX = (i) => GUTTER + i * (NODE_W + COL_GAP);
  // Assign each project a vertical "track" within its lane. A project inherits the track of its
  // same-lane prerequisite (processed left-to-right by quarter) when that track is free, so chained
  // dependencies line up on one row and their arrows run straight instead of crossing.
  const effPts = (p) => EFFORT_POINTS[p.effort] || EFFORT_POINTS.M;
  const trackOf = {}; const laneTracks = {};
  lanes.forEach((w) => {
    const usedByCol = {}; let maxTrack = 0;
    quarters.forEach((q, ci) => {
      const used = (usedByCol[ci] = usedByCol[ci] || new Set());
      const cps = cell[w][q].map((p) => {
        const pre = (p.dependsOn || []).map((d) => (laneOfProj[d.id] === w ? trackOf[d.id] : null)).filter((t) => t != null);
        return { p, pref: pre.length ? Math.min(...pre) : null };
      });
      // dependency-aligned projects claim their prerequisite's track first; the rest sort large→small (effort)
      cps.sort((a, b) => {
        if (a.pref != null && b.pref != null) return a.pref - b.pref;
        if (a.pref != null) return -1;
        if (b.pref != null) return 1;
        return effPts(b.p) - effPts(a.p);
      });
      cps.forEach(({ p, pref }) => {
        let track = pref != null ? pref : 0;
        while (used.has(track)) track++;
        used.add(track); trackOf[p.id] = track; if (track > maxTrack) maxTrack = track;
      });
    });
    laneTracks[w] = maxTrack + 1;
  });
  const laneY = {}, laneH = {}; let acc = TOP;
  lanes.forEach((w) => { laneY[w] = acc; laneH[w] = PADY + laneTracks[w] * (NODE_H + V_GAP); acc += laneH[w]; });
  const pos = {};
  lanes.forEach((w) => quarters.forEach((q) => cell[w][q].forEach((p) => { pos[p.id] = { x: colX(qIndex[q]), y: laneY[w] + PADY / 2 + trackOf[p.id] * (NODE_H + V_GAP) }; })));
  const width = colX(quarters.length - 1) + NODE_W + 16;
  const height = acc + 6;
  const edges = [];
  projects.forEach((p) => (p.dependsOn || []).forEach((d) => { if (pos[d.id] && pos[p.id]) edges.push([d.id, p.id]); }));
  const trunc = (s, n) => { const str = String(s); return str.length > n ? str.slice(0, n - 1) + "…" : str; };
  const tab = (k) => <button key={k} onClick={() => setGroupBy(k)} style={{ fontFamily: T.body, fontSize: 12, fontWeight: groupBy === k ? 600 : 500, padding: "4px 11px", borderRadius: 999, border: `1px solid ${groupBy === k ? T.ink : T.hairline}`, background: groupBy === k ? T.ink : T.surface, color: groupBy === k ? "#fff" : T.inkSoft }}>{SEQ_GROUPS[k].label}</button>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={h2Style}>Sequence by {g.label.toLowerCase()} × quarter</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.inkSoft }}>GROUP BY</span>
          {["workstream", "effort", "impact"].map(tab)}
          <button onClick={() => setShowDeps((v) => !v)} title="Toggle dependency arrows" style={{ fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "4px 11px", borderRadius: 999, border: `1px solid ${showDeps ? "#A33D3D" : T.hairline}`, background: showDeps ? "#FBE0DE" : T.surface, color: showDeps ? "#A33D3D" : T.inkSoft, whiteSpace: "nowrap" }}>{showDeps ? "→ Dependencies shown" : "Dependencies hidden"}</button>
        </div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 12, overflowX: "auto" }}>
        <svg width={Math.max(width, 280)} height={height} style={{ display: "block" }} role="img" aria-label={`Sequence by ${g.label} and quarter`}>
          <defs><marker id="seqArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#A33D3D" fillOpacity="0.65" /></marker></defs>
          {/* lane bands + labels */}
          {lanes.map((w, li) => {
            const lc = g.color(w);
            return (
              <g key={String(w)}>
                {li % 2 === 1 && <rect x={0} y={laneY[w]} width={width} height={laneH[w]} fill={T.paper} />}
                <rect x={0} y={laneY[w]} width={4} height={laneH[w]} fill={lc} />
                <line x1={0} y1={laneY[w]} x2={width} y2={laneY[w]} stroke={T.hairline} />
                <foreignObject x={8} y={laneY[w]} width={GUTTER - 16} height={laneH[w]}>
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{ height: "100%", display: "flex", alignItems: "center", fontFamily: T.body, fontWeight: 700, fontSize: 11.5, lineHeight: 1.18, color: lc, wordBreak: "break-word" }}>{g.name(w)}</div>
                </foreignObject>
              </g>
            );
          })}
          {/* quarter column guides + headers (count + total impact + total effort) */}
          {quarters.map((q, i) => i === 0 ? null : <line key={"g" + q} x1={colX(i) - COL_GAP / 2} y1={TOP} x2={colX(i) - COL_GAP / 2} y2={height} stroke={T.hairlineSoft} />)}
          {quarters.map((q, i) => (
            <g key={q}>
              <text x={colX(i)} y={16} fontSize="11" fontFamily={T.mono} fontWeight="700" fill={T.ink} letterSpacing="0.06em">{q.toUpperCase()}</text>
              <text x={colX(i)} y={33} fontSize="10.5" fontFamily={T.body} fill={T.inkSoft}>{qCount[q]} proj · <tspan fontWeight="700" fill="#1E8A4C">{qImpact[q]}</tspan> impact · <tspan fontWeight="700" fill="#C5651C">{qEffort[q]}</tspan> effort</text>
            </g>
          ))}
          {/* dependency arrows */}
          {showDeps && edges.map(([from, to], i) => {
            const a = pos[from], b = pos[to]; const sameX = Math.abs(a.x - b.x) < 1;
            const sx = a.x + (b.x >= a.x ? NODE_W : 0), sy = a.y + NODE_H / 2;
            const ex = b.x + (b.x >= a.x ? 0 : NODE_W), ey = b.y + NODE_H / 2; const mx = (sx + ex) / 2;
            // same quarter (same column): exit the prerequisite's RIGHT edge and curve back into the dependent's LEFT edge
            const d = sameX ? `M ${a.x + NODE_W} ${sy} C ${a.x + NODE_W + 44} ${sy}, ${b.x - 44} ${ey}, ${b.x} ${ey}` : `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
            return <path key={i} d={d} fill="none" stroke="#A33D3D" strokeWidth="1.6" opacity="0.65" markerEnd="url(#seqArrow)" />;
          })}
          {/* project nodes — HTML so long titles wrap instead of truncating; effort + impact color-coded like the board */}
          {projects.map((p) => {
            const ws = wsMeta(p.workstream); const pp = pos[p.id]; if (!pp) return null; const { x: nx, y: ny } = pp;
            return (
              <foreignObject key={p.id} x={nx} y={ny} width={NODE_W} height={NODE_H} onClick={() => onOpen(p.id)} style={{ cursor: "pointer", overflow: "visible" }}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ height: "100%", boxSizing: "border-box", background: T.surface, border: `1px solid ${T.hairline}`, borderLeft: `4px solid ${ws.color}`, borderRadius: 10, padding: "7px 10px", overflow: "hidden", fontFamily: T.body, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: ws.color, letterSpacing: "0.06em" }}>{p.code}</div>
                  <div title={p.title} style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: T.ink, lineHeight: 1.22, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 5 }}><EffortChip effort={p.effort} /><ImpactChip impact={p.impact} /></div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ---------- RESOURCING ---------- */
const TEAM_W = 230, CAP_W = 96;
// commit-on-blur capacity input: free typing (incl. 3 digits) without per-keystroke clamping/saving
function CapInput({ value, onCommit }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => { const n = Math.max(1, Math.round(Number(v) || 0) || 1); onCommit(n); setV(String(n)); };
  return <input type="number" min="1" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} style={{ width: 60, fontFamily: T.mono, fontSize: 12, fontWeight: 600, padding: "3px 6px", border: `1px solid ${T.hairline}`, borderRadius: 6, color: T.ink, background: T.surface, textAlign: "center" }} />;
}
const FROZEN = { team: { position: "sticky", left: 0, zIndex: 2, borderRight: `1px solid ${T.hairline}` }, cap: { position: "sticky", left: TEAM_W, zIndex: 2, borderRight: `1px solid ${T.hairline}` } };
function Resourcing({ projects, org, capacities, unlocked, onSaveOrg, onOpen }) {
  const [managing, setManaging] = useState(false);
  const [rosterDirty, setRosterDirty] = useState(false);
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [mode, setMode] = useState("quarter"); // "quarter" | "project"
  // cap edits are buffered as a label→hours OVERLAY and only persisted (onto the org) on Save
  const [capDraft, setCapDraft] = useState({});
  const [capSaving, setCapSaving] = useState(false);
  const capDraftRef = useRef(capDraft); capDraftRef.current = capDraft;
  const capDirty = Object.keys(capDraft).length > 0;
  const editCap = (label, n) => setCapDraft((c) => ({ ...c, [label]: n }));
  const saveCaps = async () => {
    if (typeof document !== "undefined" && document.activeElement && document.activeElement.blur) document.activeElement.blur(); // flush a focused cap field
    await new Promise((r) => setTimeout(r, 0));
    setCapSaving(true);
    try { await onSaveOrg(applyCapsToOrg(org, capDraftRef.current, capacities)); setCapDraft({}); } finally { setCapSaving(false); }
  };
  const [colorMode, setColorMode] = useState("cap"); // "cap" (vs capacity, default) | "comparison" (heatmap by relative load)
  const toggleManage = () => {
    if (managing && rosterDirty && !window.confirm("You have unsaved roster changes. Discard them?")) return;
    setManaging((m) => !m); setRosterDirty(false);
  };
  const exportRoster = () => {
    const blob = new Blob([rosterToCsv(org, capacities)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "revops-roster.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const quarters = useMemo(() => Array.from(new Set(projects.flatMap((p) => projectAssignments(p).map((a) => a.quarter)))).sort((a, b) => targetRank(a) - targetRank(b)), [projects]);
  const categories = useMemo(() => Array.from(new Set(projects.map((p) => p.workstream || "Other"))), [projects]);
  // by-project view: order columns by quarter (then category/number) so projects group under their quarter
  const projCols = useMemo(() => (mode === "project" ? [...projects].sort((a, b) => targetRank(a.targetWindow || "TBD") - targetRank(b.targetWindow || "TBD") || byCategoryThenNumber(a, b)) : projects), [projects, mode]);
  const projQSpans = useMemo(() => { const s = []; projCols.forEach((p) => { const q = p.targetWindow || "TBD"; const last = s[s.length - 1]; if (last && last.q === q) last.len++; else s.push({ q, len: 1 }); }); return s; }, [projCols]);
  const qStartIds = useMemo(() => { const set = new Set(); let prev = null; projCols.forEach((p, i) => { const q = p.targetWindow || "TBD"; if (i > 0 && q !== prev) set.add(p.id); prev = q; }); return set; }, [projCols]);
  // by-category view: split each category into its quarters (category × quarter columns)
  const catQCols = useMemo(() => categories.flatMap((c) => quarters.map((q) => ({ cat: c, q, key: c + "||" + q }))), [categories, quarters]);
  const catSpans = useMemo(() => categories.map((c) => ({ cat: c, len: quarters.length })), [categories, quarters]);
  const catQStart = useMemo(() => { const s = new Set(); categories.forEach((c, i) => { if (i > 0) s.add(c + "||" + quarters[0]); }); return s; }, [categories, quarters]);
  const resources = useMemo(() => allResources(org), [org]);
  const byGroup = {};
  (org || []).forEach((g) => { byGroup[g.name] = []; });
  resources.forEach((r) => {
    const unitsBy = {}, unitsByQ = {}, unitsByCat = {}, unitsByCatQ = {}; let units = 0;
    projects.forEach((p) => {
      const mine = projectAssignments(p).filter((a) => matchesResource(r, a.owner));
      if (!mine.length) return;
      const u = mine.reduce((s, a) => s + a.pts, 0);
      unitsBy[p.id] = u; units += u;
      const c = p.workstream || "Other"; unitsByCat[c] = (unitsByCat[c] || 0) + u;
      mine.forEach((a) => { unitsByQ[a.quarter] = (unitsByQ[a.quarter] || 0) + a.pts; const k = c + "||" + a.quarter; unitsByCatQ[k] = (unitsByCatQ[k] || 0) + a.pts; });
    });
    const peak = Math.max(0, ...Object.values(unitsByQ));
    (byGroup[r.group] = byGroup[r.group] || []).push({ ...r, unitsBy, unitsByQ, unitsByCat, unitsByCatQ, units, peak });
  });
  const allRows = Object.values(byGroup).flat();
  const cellMax = Math.max(1, ...allRows.flatMap((r) => Object.values(mode === "project" ? r.unitsBy : mode === "category" ? r.unitsByCatQ : r.unitsByQ)));
  // effective cap per team = unsaved overlay → team's stored cap → legacy capacities map → default
  const effCaps = {}; allRows.forEach((r) => { effCaps[r.label] = capDraft[r.label] != null ? capDraft[r.label] : teamCap(r, capacities); });
  const tab = (k, label) => <button onClick={() => setMode(k)} style={{ fontFamily: T.body, fontSize: 12, fontWeight: mode === k ? 600 : 500, padding: "5px 11px", borderRadius: 999, border: `1px solid ${mode === k ? T.ink : T.hairline}`, background: mode === k ? T.ink : T.surface, color: mode === k ? "#fff" : T.inkSoft }}>{label}</button>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ ...h2Style, marginBottom: 2 }}>Resourcing & allocation</h2>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: 0 }}>{mode === "project" ? "Team roster × projects — each cell is that project's hours. The team column stays pinned; project columns scroll." : mode === "category" ? "Team roster × category × quarter — each category is split into its quarters, so you can see who carries each category over time." : "Team roster × quarter — each cell sums a team's hours for that quarter. vs-capacity coloring is a traffic light against each team's hour cap (green under, amber near, red over ⚠); switch to comparative to shade by relative load instead."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft }}>
          <button onClick={exportRoster} title="Download the team roster as CSV" style={btnGhost}>↓ Export roster</button>
          {unlocked && <button onClick={() => setShowRosterImport(true)} title="Replace the whole roster from a CSV" style={btnGhost}>↑ Import roster</button>}
          {unlocked && <button onClick={toggleManage} style={btnGhost}>{managing ? "Done" : "✎ Manage teams"}</button>}
          <span style={{ letterSpacing: "0.06em" }}>HOURS</span>
          {EFFORTS.map((s) => <span key={s} style={{ padding: "2px 7px", borderRadius: 6, background: T.hairlineSoft, color: T.ink, fontWeight: 700 }}>{s}={EFFORT_HOURS[s]}h</span>)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.inkSoft, marginRight: 2 }}>VIEW</span>
        {tab("quarter", "By quarter")}{tab("category", "By category")}{tab("project", "By project")}
        <span style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.inkSoft, margin: "0 2px 0 14px" }}>COLOR</span>
        <button onClick={() => setColorMode("cap")} style={{ fontFamily: T.body, fontSize: 12, fontWeight: colorMode === "cap" ? 600 : 500, padding: "5px 11px", borderRadius: 999, border: `1px solid ${colorMode === "cap" ? T.ink : T.hairline}`, background: colorMode === "cap" ? T.ink : T.surface, color: colorMode === "cap" ? "#fff" : T.inkSoft }}>vs capacity</button>
        <button onClick={() => setColorMode("comparison")} style={{ fontFamily: T.body, fontSize: 12, fontWeight: colorMode === "comparison" ? 600 : 500, padding: "5px 11px", borderRadius: 999, border: `1px solid ${colorMode === "comparison" ? T.ink : T.hairline}`, background: colorMode === "comparison" ? T.ink : T.surface, color: colorMode === "comparison" ? "#fff" : T.inkSoft }}>comparative</button>
      </div>

      {showRosterImport && <RosterImportModal onClose={() => setShowRosterImport(false)} onApply={onSaveOrg} />}
      {managing && unlocked && <OrgEditor org={org} onSave={onSaveOrg} onDirty={setRosterDirty} />}

      {unlocked && capDirty && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF8EC", border: "1px solid #E9D08A", borderRadius: 10, padding: "8px 14px" }}>
          <span style={{ fontSize: 12.5, color: "#9A6A12", fontWeight: 600 }}>Unsaved capacity changes</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCapDraft({})} disabled={capSaving} style={btnGhost}>Discard</button>
          <button onClick={saveCaps} disabled={capSaving} style={{ ...btnSolid, opacity: capSaving ? 0.5 : 1 }}>{capSaving ? "Saving…" : "Save capacities"}</button>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760, fontFamily: T.body }}>
          <thead>
            {(mode === "project" || mode === "category") && (
              <tr>
                <th style={{ ...thStyle, ...FROZEN.team, zIndex: 3, background: T.paper, minWidth: TEAM_W, width: TEAM_W }} />
                {colorMode === "cap" && <th style={{ ...thStyle, ...FROZEN.cap, zIndex: 3, background: T.paper, width: CAP_W }} />}
                {mode === "project"
                  ? projQSpans.map((s, i) => <th key={s.q + i} colSpan={s.len} style={{ ...thStyle, textAlign: "center", color: T.ink, background: T.paper, borderLeft: `2px solid ${T.hairline}` }}>{s.q.toUpperCase()}</th>)
                  : catSpans.map((s, i) => <th key={s.cat} colSpan={s.len} style={{ ...thStyle, textAlign: "center", color: wsMeta(s.cat).color, background: T.paper, borderLeft: i > 0 ? `2px solid ${T.hairline}` : undefined, whiteSpace: "normal", lineHeight: 1.2, minWidth: 96 }}>{s.cat}</th>)}
              </tr>
            )}
            <tr>
              <th style={{ ...thStyle, ...FROZEN.team, zIndex: 3, textAlign: "left", minWidth: TEAM_W, width: TEAM_W }}>Team / resource</th>
              {colorMode === "cap" && <th style={{ ...thStyle, ...FROZEN.cap, zIndex: 3, width: CAP_W, lineHeight: 1.15 }} title="Total capacity hours available per quarter">Capacity<br /><span style={{ fontWeight: 500, color: T.inkSoft }}>hrs/qtr</span></th>}
              {mode === "project"
                ? projCols.map((p) => { const ws = wsMeta(p.workstream); return <th key={p.id} style={{ ...thStyle, borderLeft: qStartIds.has(p.id) ? `2px solid ${T.hairline}` : undefined }}><button onClick={() => onOpen(p.id)} title={`${p.title} · ${p.targetWindow || "TBD"}`} style={{ background: "none", border: "none", color: ws.color, fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>{p.code}</button></th>; })
                : mode === "category"
                  ? catQCols.map((col) => <th key={col.key} title={`${col.cat} · ${col.q}`} style={{ ...thStyle, borderLeft: catQStart.has(col.key) ? `2px solid ${T.hairline}` : undefined }}>{col.q.replace(" 20", " ")}</th>)
                  : quarters.map((q) => <th key={q} style={thStyle}>{q}</th>)}
            </tr>
          </thead>
          <tbody>
            {(org || []).map((g) => <ResourceGroup key={g.name} group={g.name} rows={byGroup[g.name] || []} mode={mode} colorMode={colorMode} cellMax={cellMax} projects={projCols} qStartIds={qStartIds} quarters={quarters} categories={categories} catQCols={catQCols} catQStart={catQStart} capacities={effCaps} unlocked={unlocked} onSetCapacity={editCap} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResourceGroup({ group, rows, mode, colorMode, cellMax, projects, qStartIds, quarters, categories, catQCols, catQStart, capacities, unlocked, onSetCapacity }) {
  const compare = colorMode === "comparison";
  const ncols = (mode === "project" ? projects.length : mode === "category" ? catQCols.length : quarters.length) + (compare ? 1 : 2);
  const chip = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 6px", borderRadius: 6, fontFamily: T.mono, fontSize: 11.5, fontWeight: 700 };
  return (
    <>
      <tr><td colSpan={ncols} style={{ ...FROZEN.team, borderRight: "none", padding: "10px 14px 4px", background: T.paper, fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkSoft }}>{group}</td></tr>
      {rows.map((r) => {
        const cap = capacities[r.label] ?? DEFAULT_CAP;
        // comparative → heat by relative load (all views); vs-capacity → traffic light only for the
        // by-quarter view (a single project's / category's hours vs the quarterly cap isn't meaningful)
        const capColored = !compare && mode === "quarter";
        const cellStyle = (v) => {
          if (compare) return heatStyle(v, cellMax) || {};
          if (capColored) return capHeatStyle(v, cap) || {};
          return { background: T.hairlineSoft, color: T.ink };
        };
        return (
          <tr key={r.label} style={{ borderTop: `1px solid ${T.hairlineSoft}` }}>
            <td style={{ ...FROZEN.team, background: T.surface, padding: "9px 14px", fontSize: 13, width: TEAM_W }}><div style={{ fontWeight: 600, lineHeight: 1.25 }}>{r.parent ? `${r.parent} · ${r.label}` : r.label}</div>{(r.lead || r.pm) && <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.25, marginTop: 1 }}>{[r.lead, r.pm ? `PM ${r.pm}` : ""].filter(Boolean).join(" · ")}</div>}</td>
            {!compare && <td style={{ ...FROZEN.cap, background: T.surface, textAlign: "center", padding: "0 8px" }}>{unlocked ? <CapInput value={cap} onCommit={(n) => onSetCapacity(r.label, n)} /> : <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkSoft }}>{cap}</span>}</td>}
            {mode === "project"
              ? projects.map((p) => { const v = r.unitsBy[p.id]; return <td key={p.id} style={{ textAlign: "center", padding: "9px 6px", borderLeft: qStartIds && qStartIds.has(p.id) ? `2px solid ${T.hairline}` : undefined }}>{v != null ? <span title={`${p.code} · ${p.targetWindow || "TBD"} · ${v}h`} style={{ ...chip, ...cellStyle(v) }}>{v}</span> : null}</td>; })
              : mode === "category"
                ? catQCols.map((col) => { const v = r.unitsByCatQ[col.key] || 0; return <td key={col.key} style={{ textAlign: "center", padding: "9px 6px", borderLeft: catQStart.has(col.key) ? `2px solid ${T.hairline}` : undefined }}>{v ? <span title={`${col.cat} · ${col.q} · ${v}h`} style={{ ...chip, ...cellStyle(v) }}>{v}</span> : null}</td>; })
                : quarters.map((q) => { const v = r.unitsByQ[q] || 0; const oc = capColored && v > cap; return <td key={q} style={{ textAlign: "center", padding: "9px 6px" }}>{v ? <span title={compare ? `${q} · ${v}h` : `${q} · ${v}/${cap}h`} style={{ ...chip, ...cellStyle(v) }}>{v}{oc ? " ⚠" : ""}</span> : null}</td>; })}
          </tr>
        );
      })}
    </>
  );
}

/* ---------- ORG EDITOR (add/modify teams, subteams, resources) ---------- */
function OrgEditor({ org, onSave, onDirty }) {
  const [draft, setDraft] = useState(org);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0); // bump to remount the (uncontrolled) inputs after reset/save
  useEffect(() => { setDraft(org); setRev((r) => r + 1); }, [org]);
  // edits are LOCAL until "Save roster" — one batched write avoids the per-field write storm that
  // raced through the shared blob and left phantom/duplicate rows.
  // all edits arrive via onBlur or button clicks, so remounting inputs each commit keeps the
  // uncontrolled fields in sync with the draft (after add/delete/reorder) without disrupting typing
  const commit = (next) => { setDraft(next); setRev((r) => r + 1); };
  const reset = () => { setDraft(org); setRev((r) => r + 1); };
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(org), [draft, org]);
  useEffect(() => { onDirty && onDirty(dirty); }, [dirty, onDirty]);
  const save = async () => { setSaving(true); try { await onSave(draft); } finally { setSaving(false); } };

  const setGroup = (gi, fn) => draft.map((g, i) => (i === gi ? fn(g) : g));
  const setMember = (gi, mi, fn) => setGroup(gi, (g) => ({ ...g, members: g.members.map((m, i) => (i === mi ? fn(m) : m)) }));

  const inp = { fontFamily: T.body, fontSize: 12.5, padding: "3px 7px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink };

  return (
    <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div><SectionTitle>Manage roster</SectionTitle> <span style={{ fontSize: 12, color: T.inkSoft }}>— add or edit teams, sub-teams, and people. A team counts toward a project when the project names that team (or its lead) in its Team &amp; resourcing list. Changes are saved only when you click <strong>Save roster</strong>.</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {dirty && <span style={{ fontSize: 11.5, color: "#9A6A12", fontWeight: 600 }}>Unsaved changes</span>}
          {dirty && <button onClick={reset} disabled={saving} style={btnGhost}>Discard</button>}
          <button onClick={save} disabled={!dirty || saving} style={{ ...btnSolid, opacity: !dirty || saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save roster"}</button>
        </div>
      </div>
      <div key={rev} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {draft.map((g, gi) => (
          <div key={gi} style={{ border: `1px solid ${T.hairline}`, borderRadius: 10, padding: "10px 12px", background: T.surface }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 8 }}>
              <input defaultValue={g.name} onBlur={(e) => { if (e.target.value !== g.name) commit(setGroup(gi, (x) => ({ ...x, name: e.target.value }))); }} placeholder="Team name" style={{ ...inp, fontWeight: 700, fontFamily: T.display, fontSize: 14, flex: 1 }} />
              <button onClick={() => commit(draft.filter((_, i) => i !== gi))} style={xBtn} aria-label="Delete team">✕ team</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
              {(g.members || []).map((m, mi) => (
                <div key={mi} style={{ borderLeft: `2px solid ${T.hairlineSoft}`, paddingLeft: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input defaultValue={m.name} onBlur={(e) => { if (e.target.value !== m.name) commit(setMember(gi, mi, (x) => ({ ...x, name: e.target.value }))); }} placeholder="Sub-team / unit" style={{ ...inp, fontWeight: 600, width: 150 }} />
                    <input defaultValue={m.lead || ""} onBlur={(e) => { if ((e.target.value || "") !== (m.lead || "")) commit(setMember(gi, mi, (x) => ({ ...x, lead: e.target.value }))); }} placeholder="Lead" style={{ ...inp, width: 130 }} />
                    <input defaultValue={m.pm || ""} onBlur={(e) => { if ((e.target.value || "") !== (m.pm || "")) commit(setMember(gi, mi, (x) => ({ ...x, pm: e.target.value || undefined }))); }} placeholder="PM" style={{ ...inp, flex: 1, minWidth: 110 }} />
                    <button onClick={() => commit(setGroup(gi, (x) => ({ ...x, members: x.members.filter((_, i) => i !== mi) })))} style={xBtn} aria-label="Delete">✕</button>
                  </div>
                  {(m.sub || []).map((s, si) => (
                    <div key={si} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", paddingLeft: 16 }}>
                      <span style={{ color: T.inkSoft, fontSize: 12 }}>↳</span>
                      <input defaultValue={s.name} onBlur={(e) => commit(setMember(gi, mi, (x) => ({ ...x, sub: x.sub.map((y, i) => (i === si ? { ...y, name: e.target.value } : y)) })))} placeholder="Resource" style={{ ...inp, width: 130 }} />
                      <input defaultValue={s.lead || ""} onBlur={(e) => commit(setMember(gi, mi, (x) => ({ ...x, sub: x.sub.map((y, i) => (i === si ? { ...y, lead: e.target.value } : y)) })))} placeholder="Lead" style={{ ...inp, width: 120 }} />
                      <input defaultValue={s.pm || ""} onBlur={(e) => commit(setMember(gi, mi, (x) => ({ ...x, sub: x.sub.map((y, i) => (i === si ? { ...y, pm: e.target.value || undefined } : y)) })))} placeholder="PM" style={{ ...inp, flex: 1, minWidth: 100 }} />
                      <button onClick={() => commit(setMember(gi, mi, (x) => ({ ...x, sub: x.sub.filter((_, i) => i !== si) })))} style={xBtn} aria-label="Delete">✕</button>
                    </div>
                  ))}
                  <button onClick={() => commit(setMember(gi, mi, (x) => ({ ...x, sub: [...(x.sub || []), { name: "New resource", lead: "" }] })))} style={{ ...addBtn, marginLeft: 16 }}>+ Add resource</button>
                </div>
              ))}
              <button onClick={() => commit(setGroup(gi, (x) => ({ ...x, members: [...(x.members || []), { name: "New sub-team", lead: "" }] })))} style={addBtn}>+ Add sub-team</button>
            </div>
          </div>
        ))}
        <button onClick={() => commit([...draft, { name: "New team", members: [] }])} style={btnSolid}>+ Add team</button>
      </div>
    </div>
  );
}

/* ---------- DETAIL DRAWER ---------- */
function Detail({ p, byId, org, unlocked, workstreams, onClose, onUpdate, onRemove, onOpen }) {
  // Edits are buffered in a local draft and only persisted on "Save changes" — one batched write,
  // no per-field autosave racing through the shared blob.
  const [draft, setDraft] = useState(p);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(p); }, [p.id]); // reset only when switching to a different project
  const up = (patch) => setDraft((cur) => ({ ...cur, ...patch }));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(p), [draft, p]);
  const saveAll = async () => {
    const diff = {};
    Object.keys(draft).forEach((k) => { if (JSON.stringify(draft[k]) !== JSON.stringify(p[k])) diff[k] = draft[k]; });
    if (!Object.keys(diff).length) return;
    setSaving(true);
    try { const updated = await onUpdate(diff); if (updated) setDraft(updated); } finally { setSaving(false); }
  };
  const discard = () => setDraft(p);
  const tryClose = () => { if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return; onClose(); };

  const ws = wsMeta(draft.workstream);
  const deps = draft.dependsOn || [];
  const committed = (draft.deliverables || []).filter((d) => !d.stretch);
  const stretch = (draft.deliverables || []).filter((d) => d.stretch);
  const depOptions = Object.values(byId).filter((x) => x.id !== p.id);
  const targetOpts = Array.from(new Set([draft.targetWindow || "TBD", ...TARGETS]));
  const [ganttMsg, setGanttMsg] = useState("");
  const [showImport, setShowImport] = useState(false);
  const ganttTasks = projectTasks(draft);
  const allDeliv = [...committed, ...stretch];
  const delSet = new Set(allDeliv.map((d) => normDel(d.text)));
  const schedNames = new Set((draft.schedule || []).map((t) => normDel(t.deliverable)));
  const unscheduled = allDeliv.filter((d) => !schedNames.has(normDel(d.text)));
  const unmatched = (draft.schedule || []).filter((t) => !delSet.has(normDel(t.deliverable)));
  const allScheduledShown = ganttTasks.length > 0 && unscheduled.length === 0 && unmatched.length === 0;
  const showBuilt = unlocked || !allScheduledShown;
  const applyTimeline = (tasks) => { up({ schedule: tasks }); setShowImport(false); setGanttMsg(`Loaded ${tasks.length} deliverable${tasks.length === 1 ? "" : "s"} into the timeline — review and Save changes.`); };
  const exportProjectTimeline = () => { const blob = new Blob([timelineToCsv([draft])], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${draft.code}-timeline.csv`; a.click(); URL.revokeObjectURL(url); };

  return (
    <>
    {showImport && <TimelineImportModal heading={`Import timeline — ${draft.code}`} deliverables={allDeliv} onClose={() => setShowImport(false)} onApply={applyTimeline} />}
    <div onClick={tryClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div className="proj-drawer" onClick={(e) => e.stopPropagation()} style={{ height: "100%", background: T.bg, overflowY: "auto", boxShadow: "-12px 0 40px rgba(28,37,33,.18)", fontFamily: T.body }}>
        <div style={{ padding: "22px 26px 18px", background: T.surface, borderBottom: `1px solid ${T.hairline}`, position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Eyebrow color={ws.color}>{draft.code}</Eyebrow>
                {unlocked ? <WorkstreamSelect value={draft.workstream} options={workstreams} color={ws.color} onChange={(v) => up({ workstream: v })} /> : <Chip bg={ws.soft} fg={ws.color}>{draft.workstream}</Chip>}
              </div>
              {unlocked ? <div style={{ marginTop: 8 }}><TextEdit value={draft.title} placeholder="Project title" big onCommit={(v) => up({ title: v })} /></div>
                : <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 24, margin: "8px 0 0", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{draft.title}</h2>}
              {(unlocked || draft.dri) && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft }}>DRI</span>
                  {unlocked ? <TextEdit value={draft.dri} placeholder="Accountable owner" onCommit={(v) => up({ dri: v })} /> : <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{draft.dri}</span>}
                </div>
              )}
            </div>
            <button onClick={tryClose} aria-label="Close" style={{ background: "none", border: `1px solid ${T.hairline}`, borderRadius: 8, width: 32, height: 32, fontSize: 16, color: T.inkSoft, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginTop: 16, border: `1px solid ${T.hairline}`, borderRadius: 10, overflow: "hidden" }}>
            <Stat label="Impact">{unlocked ? <MiniSelect value={draft.impact} options={[1, 2, 3, 4, 5]} onChange={(v) => up({ impact: Number(v) })} /> : <ScoreDots value={draft.impact} color={ws.color} />}</Stat>
            <Stat label="Effort">{unlocked ? <MiniSelect value={draft.effort || "M"} options={EFFORTS} onChange={(v) => up({ effort: v })} /> : <EffortChip effort={draft.effort} ws={ws} />}</Stat>
            <Stat label="Target">{unlocked ? <MiniSelect value={draft.targetWindow || "TBD"} options={targetOpts} onChange={(v) => up({ targetWindow: v })} /> : <span style={{ fontSize: 13, fontWeight: 600 }}>{draft.targetWindow || "TBD"}</span>}</Stat>
          </div>
        </div>

        <div className="proj-grid" style={{ padding: "20px 26px 6px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <AccentCard accent="#C0463E" icon="!" title="The problem">{unlocked ? <AreaEdit value={draft.problem} onCommit={(v) => up({ problem: v })} /> : <p style={cardText}><Linkify>{draft.problem}</Linkify></p>}</AccentCard>
            <AccentCard accent={ws.color} icon="→" title="The solution">{unlocked ? <AreaEdit value={draft.solution} onCommit={(v) => up({ solution: v })} /> : <p style={cardText}><Linkify>{draft.solution}</Linkify></p>}</AccentCard>

            <AccentCard accent="#1E8A4C" icon="✓" title="Definition of success">
              {unlocked ? <AreaEdit value={draft.success} onCommit={(v) => up({ success: v })} /> : <p style={cardText}><Linkify>{draft.success}</Linkify></p>}
            </AccentCard>

            {((draft.openItems || []).length > 0 || unlocked) && (
              <AccentCard accent="#C28A12" icon="?" title="Risks & assumptions">
                {unlocked ? <StringListEditor items={draft.openItems || []} placeholder="Add a risk or assumption" onCommit={(v) => up({ openItems: v })} />
                  : <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: T.ink }}>{(draft.openItems || []).map((o, i) => <li key={i}><Linkify>{o}</Linkify></li>)}</ul>}
              </AccentCard>
            )}
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <Panel title="Team & resourcing">
              {unlocked ? <RoleEditor items={draft.roles || []} accent={ws.color} org={org} onCommit={(v) => up({ roles: v })} /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(draft.roles || []).map((r, i) => {
                    const res = resolveResource(org, r.who);
                    return (
                      <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 13 }}>
                        <Avatar name={(res && res.lead) || r.who} color={ws.color} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                            <span style={{ fontWeight: 600 }}>{resourcePathPM(org, r.who)}</span>
                            <EffortChip effort={r.effort} />
                          </div>
                          {r.what && <div style={{ color: T.inkSoft, lineHeight: 1.45, marginTop: 2 }}><Linkify>{r.what}</Linkify></div>}
                        </div>
                      </div>
                    );
                  })}
                  {!(draft.roles || []).length && <div style={{ fontSize: 12.5, color: T.inkSoft }}>No resources assigned yet.</div>}
                </div>
              )}
            </Panel>

            {(deps.length > 0 || unlocked) && (
              <Panel title="Depends on">
                {unlocked ? <DependsEditor items={deps} options={depOptions} onCommit={(v) => up({ dependsOn: v })} /> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {deps.map((d, i) => { const dep = byId[d.id]; return <div key={i} style={{ fontSize: 13, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "baseline" }}><span style={{ color: "#A33D3D", fontWeight: 700 }}>↳</span><span>{dep ? <button onClick={() => onOpen(dep.id)} style={linkBtn}>{dep.code} — {dep.title}</button> : <span style={{ fontWeight: 600 }}>Outside this portfolio</span>}{d.note && <span style={{ color: T.inkSoft }}> — <Linkify>{d.note}</Linkify></span>}</span></div>; })}
                  </div>
                )}
              </Panel>
            )}
          </aside>
        </div>

        {/* What's being built — its own full-width section; hidden in view mode once the timeline already shows every deliverable */}
        {showBuilt && (
          <div style={{ padding: "10px 26px 0" }}>
            <Panel title={`What's being built${committed.length ? ` · ${committed.length}` : ""}`}>
              {unlocked ? <DeliverableEditor items={draft.deliverables || []} accent={ws.color} onCommit={(v) => up({ deliverables: v })} /> : (
                <>
                  <ul style={listReset}>{committed.map((d, i) => <li key={i} style={liRow}><span style={{ color: DELIV_TYPE.required.color, fontWeight: 700, marginTop: 1 }}>✓</span><span><Linkify>{d.text}</Linkify></span></li>)}</ul>
                  {stretch.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.hairline}` }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: DELIV_TYPE.optional.color, marginBottom: 8 }}>STRETCH — IF TIME ALLOWS</div>
                      <ul style={listReset}>{stretch.map((d, i) => <li key={i} style={{ ...liRow, color: T.inkSoft }}><span style={{ color: DELIV_TYPE.optional.color, marginTop: 1 }}>○</span><span><Linkify>{d.text}</Linkify></span></li>)}</ul>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>
        )}

        {/* per-project Gantt: deliverables × owners across weeks */}
        <div style={{ padding: "10px 26px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <SectionTitle>Timeline — deliverables × owner</SectionTitle>
            <div style={{ display: "flex", gap: 6 }}>
              {(draft.schedule || []).length > 0 && <button onClick={exportProjectTimeline} style={{ ...btnGhost, fontSize: 12 }}>↓ Export</button>}
              {unlocked && <button onClick={() => setShowImport(true)} style={{ ...btnGhost, fontSize: 12 }}>↑ Import CSV</button>}
            </div>
          </div>
          {ganttMsg && <div style={{ fontSize: 12, color: ganttMsg.startsWith("Loaded") ? "#0E8A74" : "#A33D3D", marginBottom: 8 }}>{ganttMsg}</div>}
          {ganttTasks.length ? (
            <>
              <div style={{ marginBottom: 8 }}><GanttLegend /></div>
              <div style={{ border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 10 }}><GanttGrid groups={[{ key: draft.id, label: "", color: ws.color, tasks: ganttTasks }]} org={org} labelHeader="Deliverable" /></div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                <span style={{ color: T.inkSoft }}><strong style={{ color: T.ink }}>{committed.length + stretch.length - unscheduled.length}/{committed.length + stretch.length}</strong> deliverables scheduled</span>
                {unscheduled.length > 0 && <span style={{ color: T.inkSoft }}><span style={{ color: "#9A6A12", fontWeight: 600 }}>Unscheduled:</span> {unscheduled.map((d) => d.text).join(" · ")}</span>}
                {unmatched.length > 0 && <span style={{ color: "#A33D3D" }}><span style={{ fontWeight: 600 }}>⚠ Not in this project's deliverables:</span> {unmatched.map((t) => t.deliverable).join(" · ")}</span>}
              </div>
            </>
          ) : (
            <div style={{ background: T.paper, border: `1px dashed ${T.hairline}`, borderRadius: 10, padding: "16px 18px", fontSize: 12.5, color: T.inkSoft, lineHeight: 1.55 }}>
              No timeline yet. {unlocked ? <>Import a CSV with one row per deliverable — columns <code style={codeChip}>deliverable, owner, start, weeks</code> (optional <code style={codeChip}>hours</code>), <code style={codeChip}>start</code> like <code style={codeChip}>Q3 2026 W2</code>.</> : "Unlock editing to import a timeline."}
              {(committed.length + stretch.length) > 0 && <div style={{ marginTop: 8 }}><strong style={{ color: T.ink }}>Deliverables to schedule:</strong> {[...committed, ...stretch].map((d) => d.text).join(" · ")}</div>}
            </div>
          )}
          {unlocked && (
            <div style={{ marginTop: 14 }}>
              <div style={{ marginBottom: 8 }}><SectionTitle>Edit timeline</SectionTitle> <span style={{ fontSize: 11.5, color: T.inkSoft }}>— pick a deliverable and a roster owner; set the quarter and start week, then a duration that can run past the quarter into later ones.</span></div>
              <TimelineEditor items={draft.schedule || []} deliverables={allDeliv} org={org} onCommit={(v) => up({ schedule: v })} />
            </div>
          )}
        </div>

        {unlocked && <div style={{ padding: "12px 26px 30px" }}><button onClick={onRemove} style={{ fontFamily: T.body, fontSize: 13, fontWeight: 500, padding: "9px 14px", borderRadius: 8, background: "none", border: "1px solid #D9A0A0", color: "#A33D3D" }}>Remove project</button></div>}

        {unlocked && (
          <div style={{ position: "sticky", bottom: 0, zIndex: 3, background: T.surface, borderTop: `1px solid ${T.hairline}`, padding: "12px 26px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 -6px 20px rgba(28,37,33,.07)" }}>
            <span style={{ fontSize: 12, color: dirty ? "#9A6A12" : T.inkSoft, fontWeight: dirty ? 600 : 500 }}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
            <div style={{ flex: 1 }} />
            {dirty && <button onClick={discard} disabled={saving} style={btnGhost}>Discard</button>}
            <button onClick={saveAll} disabled={!dirty || saving} style={{ ...btnSolid, opacity: !dirty || saving ? 0.5 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ---------- inline editors ---------- */
function TextEdit({ value, placeholder, onCommit, big }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return <input value={v} placeholder={placeholder} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} style={{ fontFamily: big ? T.display : T.body, fontSize: big ? 20 : 12.5, fontWeight: big ? 800 : 600, letterSpacing: big ? "-0.01em" : 0, padding: big ? "4px 8px" : "3px 7px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, minWidth: big ? "100%" : 150, width: big ? "100%" : undefined }} />;
}
function AreaEdit({ value, onCommit, rows = 3 }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return <textarea value={v} rows={rows} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} style={{ width: "100%", fontFamily: T.body, fontSize: 13, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, resize: "vertical" }} />;
}
function DeliverableEditor({ items, accent, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= list.length) return; const next = list.slice(); [next[i], next[j]] = [next[j], next[i]]; push(next); };
  const arrow = { background: "none", border: "none", padding: 0, width: 16, height: 14, lineHeight: "14px", fontSize: 10, color: T.inkSoft, cursor: "pointer" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {list.map((d, i) => (
        <div key={i} style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 16 }}>
            <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={{ ...arrow, opacity: i === 0 ? 0.25 : 1 }}>▲</button>
            <button onClick={() => move(i, 1)} disabled={i === list.length - 1} title="Move down" style={{ ...arrow, opacity: i === list.length - 1 ? 0.25 : 1 }}>▼</button>
          </div>
          <button title={d.stretch ? "Stretch — click to commit" : "Committed — click to mark stretch"} onClick={() => push(list.map((x, j) => j === i ? { ...x, stretch: !x.stretch } : x))} style={{ background: "none", border: "none", fontSize: 14, color: d.stretch ? "#C9A24B" : accent, width: 18 }}>{d.stretch ? "○" : "✓"}</button>
          <input value={d.text} onChange={(e) => push(list.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="Deliverable" style={{ flex: 1, fontFamily: T.body, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }} />
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, { text: "", stretch: false }])} style={addBtn}>+ Add deliverable</button>
    </div>
  );
}
function RoleEditor({ items, accent, org, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const push = (next) => { setList(next); onCommit(next); };
  const opts = allResources(org);
  // labels aren't unique across groups (e.g. two "Finance" teams). Store the lead to disambiguate
  // a duplicated label so the pick resolves to the team you chose, not the first match.
  const labelDup = {}; opts.forEach((o) => { const k = normName(o.label); labelDup[k] = (labelDup[k] || 0) + 1; });
  const ownerValue = (o) => (o.lead && labelDup[normName(o.label)] > 1 ? o.lead : o.label);
  const sel = { fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "4px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {list.map((r, i) => {
        const cur = r.who || "";
        const byLead = opts.findIndex((o) => o.lead && normName(o.lead) === normName(cur));
        const mIdx = byLead >= 0 ? byLead : opts.findIndex((o) => normName(o.label) === normName(cur));
        const matched = mIdx >= 0 ? opts[mIdx] : null;
        const selVal = matched ? String(mIdx) : (cur ? "__cur__" : "");
        const onWho = (v) => {
          if (v === "__custom__") { const c = window.prompt("Resource name (team or person):", cur); if (c != null) push(list.map((x, j) => j === i ? { ...x, who: c.trim() } : x)); return; }
          if (v === "__cur__") return;
          const o = opts[+v]; if (!o) return;
          push(list.map((x, j) => j === i ? { ...x, who: ownerValue(o) } : x));
        };
        return (
          <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <Avatar name={(matched && matched.lead) || cur || "?"} color={accent} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
                <select value={selVal} onChange={(e) => onWho(e.target.value)} style={{ ...sel, flex: 1, minWidth: 0, maxWidth: "100%" }}>
                  {!matched && cur && <option value="__cur__">{cur} (custom)</option>}
                  {!cur && <option value="" disabled>Select a team / resource…</option>}
                  {opts.map((o, idx) => <option key={idx} value={String(idx)}>{o.group} · {o.label}{o.lead ? ` · ${o.lead}` : ""}</option>)}
                  <option value="__custom__">+ Custom name…</option>
                </select>
                <MiniSelect value={r.effort || "M"} options={EFFORTS} onChange={(v) => push(list.map((x, j) => j === i ? { ...x, effort: v } : x))} />
              </div>
              <input value={r.what} onChange={(e) => push(list.map((x, j) => j === i ? { ...x, what: e.target.value } : x))} placeholder="What they do on this project" style={{ width: "100%", minWidth: 0, boxSizing: "border-box", fontFamily: T.body, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.inkSoft }} />
            </div>
            <button onClick={() => push(list.filter((_, j) => j !== i))} style={{ ...xBtn, flexShrink: 0 }} aria-label="Remove">✕</button>
          </div>
        );
      })}
      <button onClick={() => push([...list, { who: (opts[0] && opts[0].label) || "", what: "", effort: "M" }])} style={addBtn}>+ Add resource</button>
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
          <input value={s} onChange={(e) => push(list.map((x, j) => j === i ? e.target.value : x))} placeholder={placeholder} style={{ flex: 1, fontFamily: T.body, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: `1px solid #E2CF9E`, background: "#FFFDF7", color: "#6E5612" }} />
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
          <input value={d.note || ""} onChange={(e) => push(list.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} placeholder="Why it's a prerequisite" style={{ flex: 1, minWidth: 120, fontFamily: T.body, fontSize: 12.5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.inkSoft }} />
          <button onClick={() => push(list.filter((_, j) => j !== i))} style={xBtn} aria-label="Remove">✕</button>
        </div>
      ))}
      <button onClick={() => push([...list, { id: "", note: "" }])} style={addBtn}>+ Add dependency</button>
    </div>
  );
}

function Stat({ label, children }) {
  return <div style={{ flex: "1 1 0", minWidth: 88, padding: "9px 12px", background: T.surface, borderRight: `1px solid ${T.hairlineSoft}` }}><div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: "0.1em", color: T.inkSoft, marginBottom: 5 }}>{label.toUpperCase()}</div><div style={{ display: "flex", alignItems: "center", minHeight: 22 }}>{children}</div></div>;
}
function AccentCard({ accent, icon, title, children }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, background: accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>{icon}</span><SectionTitle>{title}</SectionTitle></div>{children}</div>;
}
function Panel({ title, children }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: "14px 16px" }}><div style={{ marginBottom: 10 }}><SectionTitle>{title}</SectionTitle></div>{children}</div>;
}
function MiniSelect({ value, options, onChange }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: T.body, fontSize: 12.5, fontWeight: 600, padding: "3px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink }}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}

/* ---------- CSV import ---------- */
const CSV_COLUMNS = ["title", "workstream", "effort", "impact", "target", "dri", "stakeholder", "problem", "solution", "success", "deliverables", "team", "dependsOn", "openItems"];
const CSV_TEMPLATE = `title,workstream,effort,impact,target,dri,stakeholder,problem,solution,success,deliverables,team,dependsOn,openItems
"Example Project","Supplies",L,4,"Q4 2026","Shannon Aubert","Supplies team","The pain and what it costs today.","The approach in plain language.","Measurable outcome and who owns it.","Build the thing | Wire up the sync | *Nice-to-have stretch","Business Systems :: Architects and builds :: L | HubSpot :: HubSpot build :: M | Data :: Pipelines :: S","SUP-01 :: extends its foundation","Vendor API feasibility unvalidated"`;

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* logical project field -> CSV header column name */
const FIELD_COL = { title: "title", workstream: "workstream", dri: "dri", targetWindow: "target", stakeholder: "stakeholder", problem: "problem", solution: "solution", success: "success", deliverables: "deliverables", roles: "team", dependsOn: "dependson", openItems: "openitems", impact: "impact", effort: "effort" };

// Parse a projects CSV. When upsert is true, rows whose `code` (or `id`) matches an existing
// project become UPDATES (keeping that project's id/code; only the columns present in the CSV
// are patched). All other rows are new CREATES.
function csvToProjects(text, existing, upsert = false) {
  const empty = { creates: [], updates: [], error: "Need a header row and at least one project row." };
  const rows = parseCSV(text);
  if (rows.length < 2) return empty;
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r, name) => { const j = header.indexOf(name.toLowerCase()); return j >= 0 ? (r[j] || "").trim() : ""; };
  const has = (name) => header.includes(name.toLowerCase());
  if (!has("title") && !has("code")) return { creates: [], updates: [], error: 'CSV must include a "title" or "code" column.' };

  const byCode = {};
  existing.forEach((p) => { byCode[p.code.toLowerCase()] = p; byCode[p.id.toLowerCase()] = p; });
  const codeToId = {};
  existing.forEach((p) => { codeToId[p.code.toLowerCase()] = p.id; codeToId[p.id.toLowerCase()] = p.id; });
  const usedIds = new Set(existing.map((p) => p.id));
  const usedCodes = new Set(existing.map((p) => p.code));
  const items = (s) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);
  const num = (v, d) => { const n = Number(v); return n >= 1 && n <= 5 ? n : d; };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "project";

  const raw = [];
  for (let k = 1; k < rows.length; k++) {
    const r = rows[k];
    const title = at(r, "title");
    const provided = at(r, "code");
    const match = upsert && provided ? byCode[provided.toLowerCase()] : null;
    if (!match && !title) continue; // a new project needs a title; an update needs a matching code
    const ws = at(r, "workstream") || (match ? match.workstream : "Other");
    if (match) { codeToId[match.code.toLowerCase()] = match.id; codeToId[match.id.toLowerCase()] = match.id; raw.push({ r, ws, isUpdate: true, id: match.id, code: match.code }); continue; }
    const base = slug(title);
    let id = base, n = 2; while (usedIds.has(id)) id = `${base}-${n++}`; usedIds.add(id);
    const code = provided ? provided.toUpperCase() : genCode(ws, usedCodes);
    if (provided) usedCodes.add(code);
    codeToId[code.toLowerCase()] = id; codeToId[id.toLowerCase()] = id;
    raw.push({ r, ws, isUpdate: false, id, code });
  }

  const fields = (r, ws) => {
    const effort = (at(r, "effort") || "M").toUpperCase();
    return {
      title: at(r, "title"), workstream: ws,
      dri: at(r, "dri"), targetWindow: at(r, "target") || "TBD", stakeholder: at(r, "stakeholder"),
      problem: at(r, "problem"), solution: at(r, "solution"), success: at(r, "success"),
      deliverables: items(at(r, "deliverables")).map((t) => t.startsWith("*") ? { text: t.slice(1).trim(), stretch: true } : { text: t, stretch: false }),
      roles: items(at(r, "team")).map((e) => { const a = e.split("::").map((x) => x.trim()); const eff = (a[2] || "").toUpperCase(); return { who: a[0] || "", what: a[1] || "", effort: EFFORTS.includes(eff) ? eff : "M" }; }).filter((x) => x.who),
      dependsOn: items(at(r, "dependson")).map((e) => { const a = e.split("::").map((x) => x.trim()); const ref = (a[0] || "").toLowerCase(); return { id: codeToId[ref] || ref, note: a[1] || "" }; }).filter((x) => x.id),
      openItems: items(at(r, "openitems")),
      impact: num(at(r, "impact"), 3), effort: EFFORTS.includes(effort) ? effort : "M",
    };
  };

  const creates = [], updates = [];
  raw.forEach(({ r, ws, isUpdate, id, code }) => {
    const f = fields(r, ws);
    if (isUpdate) {
      const patch = { id, _code: code };
      // only touch the fields the CSV actually carried (so a partial CSV doesn't wipe other columns)
      Object.keys(FIELD_COL).forEach((field) => { if (has(FIELD_COL[field])) patch[field] = f[field]; });
      updates.push(patch);
    } else {
      creates.push({ id, code, ...f });
    }
  });
  return { creates, updates, error: (creates.length || updates.length) ? "" : "No usable rows found." };
}

/* ---------- CSV export ---------- */
function csvCell(v) { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function projectsToCsv(projects) {
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const cols = ["code", ...CSV_COLUMNS];
  const lines = [cols.join(",")];
  projects.forEach((p) => {
    const cell = {
      code: p.code || "", title: p.title || "", workstream: p.workstream || "", effort: p.effort || "M",
      impact: p.impact ?? "", target: p.targetWindow || "", dri: p.dri || "", stakeholder: p.stakeholder || "",
      problem: p.problem || "", solution: p.solution || "", success: p.success || "",
      deliverables: (p.deliverables || []).map((d) => (d.stretch ? "*" : "") + d.text).join(" | "),
      team: (p.roles || []).map((r) => `${r.who} :: ${r.what} :: ${r.effort || "M"}`).join(" | "),
      dependson: (p.dependsOn || []).map((d) => `${byId[d.id] ? byId[d.id].code : d.id} :: ${d.note || ""}`).join(" | "),
      openitems: (p.openItems || []).join(" | "),
    };
    lines.push(cols.map((c) => csvCell(cell[c.toLowerCase()])).join(","));
  });
  return lines.join("\n");
}
// a team's capacity: prefer the cap stored on the team, fall back to the legacy capacities map
function teamCap(r, legacy = {}) { return r && r.cap != null ? r.cap : (legacy[r.label] ?? DEFAULT_CAP); }
// write a label→cap overlay onto the org tree (cap lives on each team, not a side map)
function applyCapsToOrg(org, capByLabel, legacy = {}) {
  const pick = (name, cur) => (capByLabel[name] != null ? capByLabel[name] : (cur != null ? cur : legacy[name]));
  return (org || []).map((g) => ({ ...g, members: (g.members || []).map((m) => {
    const out = { ...m }; const c = pick(m.name, m.cap); if (c != null) out.cap = c;
    if (m.sub) out.sub = m.sub.map((s) => { const so = { ...s }; const sc = pick(s.name, s.cap); if (sc != null) so.cap = sc; return so; });
    return out;
  }) }));
}
function rosterToCsv(org, capacities = {}) {
  const cols = ["group", "team", "parent", "lead", "pm", "cap"];
  const lines = [cols.join(",")];
  allResources(org).forEach((r) => { lines.push([r.group, r.label, r.parent || "", r.lead || "", r.pm || "", teamCap(r, capacities)].map(csvCell).join(",")); });
  return lines.join("\n");
}
// Rebuild the whole org from a roster CSV (same columns Export roster produces:
// group, team, parent, lead, pm, cap). Rows with a `parent` are sub-teams of that member.
// Returns capacities only if the CSV carried a `cap` column (else null → keep existing caps).
function csvToOrg(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { org: null, capacities: null, count: 0, error: "Need a header row and at least one team row." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r, n) => { const j = header.indexOf(n); return j >= 0 ? (r[j] || "").trim() : ""; };
  if (!header.includes("group") || !header.includes("team")) return { org: null, capacities: null, count: 0, error: 'CSV needs "group" and "team" columns.' };
  const hasCap = header.includes("cap");
  const capOf = (r) => { if (!hasCap) return undefined; const c = Number(at(r, "cap")); return c >= 1 ? Math.round(c) : undefined; };
  const groups = []; const gmap = {};
  const getGroup = (name) => { if (!gmap[name]) { gmap[name] = { name, members: [], _m: {} }; groups.push(gmap[name]); } return gmap[name]; };
  let count = 0;
  for (let k = 1; k < rows.length; k++) {
    const r = rows[k];
    const group = at(r, "group"), team = at(r, "team");
    if (!group || !team) continue;
    const parent = at(r, "parent"), lead = at(r, "lead"), pm = at(r, "pm"), cap = capOf(r);
    const g = getGroup(group);
    if (parent) {
      let mem = g._m[parent];
      if (!mem) { mem = { name: parent, lead: "", sub: [] }; g._m[parent] = mem; g.members.push(mem); }
      if (!mem.sub) mem.sub = [];
      mem.sub.push({ name: team, lead: lead || "", ...(pm ? { pm } : {}), ...(cap != null ? { cap } : {}) });
    } else {
      let mem = g._m[team];
      if (!mem) { mem = { name: team, lead: lead || "" }; if (pm) mem.pm = pm; if (cap != null) mem.cap = cap; g._m[team] = mem; g.members.push(mem); }
      else { if (lead) mem.lead = lead; if (pm) mem.pm = pm; if (cap != null) mem.cap = cap; }
    }
    count++;
  }
  const org = groups.map((g) => ({ name: g.name, members: g.members.map((m) => { const mm = { name: m.name, lead: m.lead || "" }; if (m.pm) mm.pm = m.pm; if (m.cap != null) mm.cap = m.cap; if (m.sub && m.sub.length) mm.sub = m.sub; return mm; }) }));
  return { org, count, error: count ? "" : "No valid team rows found." };
}
function timelineToCsv(projects) {
  const cols = ["projectCode", "deliverable", "owner", "start", "weeks", "hours"];
  const lines = [cols.join(",")];
  projects.forEach((p) => (p.schedule || []).forEach((t) => { lines.push([p.code, t.deliverable, t.owner || "", t.start || "", t.weeks || "", EFFORT_HOURS[t.effort] || EFFORT_HOURS.M].map(csvCell).join(",")); }));
  return lines.join("\n");
}

/* ---------- build-plan (deliverable scheduling) ---------- */
const DEFAULT_WEEKLY_CAP = 3;
const WEEKS_PER_Q = 13;
function parseStart(s) {
  const m = (s || "").match(/Q\s*([1-4])\D+(\d{4})\D+W\s*(\d+)/i);
  if (!m) return null;
  const q = +m[1], year = +m[2], wk = Math.max(1, +m[3]);
  return ((year - 2025) * 4 + (q - 1)) * WEEKS_PER_Q + (wk - 1);
}
function weekLabel(idx) {
  const qOrd = Math.floor(idx / WEEKS_PER_Q), wk = (idx % WEEKS_PER_Q) + 1;
  const q = (qOrd % 4) + 1, year = 2025 + Math.floor(qOrd / 4);
  return { q: `Q${q} ${year}`, wk };
}
const Q_MONTH = { 1: 0, 2: 3, 3: 6, 4: 9 };
function weekDate(idx) {
  const { q, wk } = weekLabel(idx); const m = q.match(/Q([1-4])\s*(\d{4})/); if (!m) return "";
  const d = new Date(+m[2], Q_MONTH[+m[1]], 1 + (wk - 1) * 7);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function buildPlanToCsv(projects, org) {
  const cols = ["projectCode", "deliverable", "stretch", "workstream", "quarter", "projectEffort", "candidateOwners", "dependsOn", "owner", "start", "weeks", "hours"];
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const lines = [cols.join(",")];
  projects.forEach((p) => {
    const cands = Array.from(new Set((p.roles || []).map((r) => { const res = resolveResource(org, r.who); return (res && res.lead) || r.who; }).filter(Boolean)));
    const deps = (p.dependsOn || []).map((d) => (byId[d.id] ? byId[d.id].code : d.id)).join(" | ");
    (p.deliverables || []).forEach((d) => {
      lines.push([p.code, d.text, d.stretch ? "yes" : "", p.workstream, p.targetWindow || "TBD", p.effort || "M", cands.join(" | "), deps, "", "", "", ""].map(csvCell).join(","));
    });
  });
  return lines.join("\n");
}
function csvToSchedule(text, projects) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { byProjectId: {}, count: 0, error: "Need a header row and at least one task row." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r, name) => { const j = header.indexOf(name.toLowerCase()); return j >= 0 ? (r[j] || "").trim() : ""; };
  if (!header.includes("projectcode") || !header.includes("deliverable")) return { byProjectId: {}, count: 0, error: 'CSV needs at least "projectCode" and "deliverable" columns.' };
  const codeToId = {}; projects.forEach((p) => { codeToId[(p.code || "").toLowerCase()] = p.id; codeToId[(p.id || "").toLowerCase()] = p.id; });
  const byProjectId = {}; let count = 0;
  for (let k = 1; k < rows.length; k++) {
    const r = rows[k];
    const code = at(r, "projectcode"); const owner = at(r, "owner"); const start = at(r, "start"); const weeks = at(r, "weeks");
    if (!code || !owner || !start || !weeks) continue; // only scheduled rows
    const id = codeToId[code.toLowerCase()]; if (!id) continue;
    const hrs = at(r, "hours"); const eff0 = (at(r, "effort") || "").toUpperCase();
    const effort = hrs ? (hoursToEffort(hrs) || "M") : (EFFORTS.includes(eff0) ? eff0 : "M");
    (byProjectId[id] = byProjectId[id] || []).push({ deliverable: at(r, "deliverable"), owner, start, weeks: Math.max(1, Number(weeks) || 1), effort });
    count++;
  }
  return { byProjectId, count, error: count ? "" : "No fully-scheduled rows found (need owner, start, and weeks filled in)." };
}

/* ---------- SCHEDULE (deliverables × people × weeks) ---------- */
/* tasks for a project's Gantt = its scheduled deliverables (start = "Q# YYYY W#", weeks = duration) */
function projectTasks(p) {
  const ws = wsMeta(p.workstream);
  const stretchSet = new Set((p.deliverables || []).filter((d) => d.stretch).map((d) => normDel(d.text)));
  return (p.schedule || []).map((t, i) => {
    const idx = parseStart(t.start); if (idx == null) return null;
    return { key: p.id + "-" + i, projectId: p.id, code: p.code, deliverable: t.deliverable, owner: t.owner || "", effort: t.effort || "M", stretch: stretchSet.has(normDel(t.deliverable)), ws, idx, weeks: Math.max(1, Number(t.weeks) || 1) };
  }).filter(Boolean).sort((a, b) => a.idx - b.idx || b.weeks - a.weeks);
}
/* lenient per-project task CSV: deliverable, owner, start, weeks (projectCode optional/ignored) */
function parseTasksCsv(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { tasks: [], error: "Need a header row and at least one task row." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (r, n) => { const j = header.indexOf(n); return j >= 0 ? (r[j] || "").trim() : ""; };
  if (!header.includes("deliverable")) return { tasks: [], error: 'CSV needs a "deliverable" column.' };
  const tasks = [];
  for (let k = 1; k < rows.length; k++) {
    const r = rows[k]; const del = at(r, "deliverable"), owner = at(r, "owner"), start = at(r, "start"), weeks = at(r, "weeks");
    if (!del || !start || !weeks) continue;
    if (parseStart(start) == null) continue;
    const hrs = at(r, "hours"); const eff0 = (at(r, "effort") || "").toUpperCase();
    const effort = hrs ? (hoursToEffort(hrs) || "M") : (EFFORTS.includes(eff0) ? eff0 : "M");
    tasks.push({ deliverable: del, owner, start, weeks: Math.max(1, Number(weeks) || 1), effort });
  }
  return { tasks, error: tasks.length ? "" : "No valid rows (need deliverable, start like 'Q3 2026 W2', and weeks)." };
}

/* manual timeline editor: one row per scheduled task; deliverable + owner are roster/deliverable-matched dropdowns */
function TimelineEditor({ items, deliverables, org, onCommit }) {
  const [list, setList] = useState(items);
  useEffect(() => { setList(items); }, [items]);
  const commit = (next) => { setList(next); onCommit(next); };
  const upd = (i, patch) => commit(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const opts = allResources(org);
  const labelDup = {}; opts.forEach((o) => { const k = normName(o.label); labelDup[k] = (labelDup[k] || 0) + 1; });
  const ownerValue = (o) => (o.lead && labelDup[normName(o.label)] > 1 ? o.lead : o.label);
  const delTexts = deliverables.map((d) => d.text);
  const split = (s) => { const m = (s || "").match(/(Q[1-4]\s*\d{4})\s*W\s*(\d+)/i); return m ? { q: m[1].replace(/\s+/g, " "), wk: Math.max(1, Math.min(13, +m[2])) } : { q: QUARTERS[0], wk: 1 }; };
  const sel = { fontFamily: T.body, fontSize: 12, padding: "4px 6px", borderRadius: 6, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink };
  const lbl = (s) => <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "0.06em", color: T.inkSoft }}>{s}</span>;
  const wkOpts = Array.from({ length: 13 }, (_, k) => k + 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((t, i) => {
        const { q, wk } = split(t.start);
        const cur = t.owner || "";
        const byLead = opts.findIndex((o) => o.lead && normName(o.lead) === normName(cur));
        const moIdx = byLead >= 0 ? byLead : opts.findIndex((o) => normName(o.label) === normName(cur));
        const mo = moIdx >= 0 ? opts[moIdx] : null;
        const delKnown = delTexts.some((x) => normDel(x) === normDel(t.deliverable));
        return (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap", borderBottom: `1px solid ${T.hairlineSoft}`, paddingBottom: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "2 1 220px", minWidth: 170 }}>{lbl("DELIVERABLE")}
              <select value={delKnown ? t.deliverable : "__cur__"} onChange={(e) => { if (e.target.value !== "__cur__") upd(i, { deliverable: e.target.value }); }} style={sel}>
                {!delKnown && <option value="__cur__">{t.deliverable ? `${t.deliverable} — not a deliverable` : "(choose a deliverable)"}</option>}
                {delTexts.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 170px", minWidth: 140 }}>{lbl("OWNER")}
              <select value={mo ? String(moIdx) : (cur ? "__cur__" : "")} onChange={(e) => { const v = e.target.value; if (v === "__custom__") { const c = window.prompt("Owner (team or person):", cur); if (c != null) upd(i, { owner: c.trim() }); } else if (v !== "__cur__") { const o = opts[+v]; if (o) upd(i, { owner: ownerValue(o) }); } }} style={sel}>
                {!mo && cur && <option value="__cur__">{cur} (off-roster)</option>}
                {!cur && <option value="" disabled>Select…</option>}
                {opts.map((o, idx) => <option key={idx} value={String(idx)}>{o.group} · {o.label}{o.lead ? ` · ${o.lead}` : ""}</option>)}
                <option value="__custom__">+ Custom…</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>{lbl("QUARTER")}
              <select value={q} onChange={(e) => upd(i, { start: `${e.target.value} W${wk}` })} style={sel}>{QUARTERS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>{lbl("WEEK")}
              <select value={wk} onChange={(e) => upd(i, { start: `${q} W${e.target.value}` })} style={sel}>{wkOpts.map((w) => <option key={w} value={w}>W{w}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>{lbl("WEEKS")}
              <input type="number" min={1} value={Math.max(1, Number(t.weeks) || 1)} onChange={(e) => upd(i, { weeks: Math.max(1, Number(e.target.value) || 1) })} title="Duration in weeks — may run past the quarter into later ones" style={{ ...sel, width: 58 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>{lbl("HOURS")}
              <select value={t.effort || "M"} onChange={(e) => upd(i, { effort: e.target.value })} title="Estimated hours — drives this team's load in Resourcing" style={sel}>{EFFORTS.map((x) => <option key={x} value={x}>{EFFORT_HOURS[x]}h</option>)}</select>
            </label>
            <button onClick={() => commit(list.filter((_, j) => j !== i))} style={{ ...xBtn, marginBottom: 5 }} aria-label="Remove">✕</button>
          </div>
        );
      })}
      <button onClick={() => commit([...list, { deliverable: delTexts[0] || "", owner: "", start: `${QUARTERS[0]} W1`, weeks: 1, effort: "M" }])} style={addBtn}>+ Add timeline row</button>
    </div>
  );
}

/* shared weekly Gantt: groups = [{ key, label, color, tasks:[projectTasks-shape] }].
   Columns flex to fill width (minmax) so a short timeline doesn't leave dead space. */
function GanttGrid({ groups, org, onOpen, labelHeader = "Deliverable" }) {
  const all = groups.flatMap((g) => g.tasks);
  if (!all.length) return null;
  const minIdx = Math.min(...all.map((t) => t.idx)), maxIdx = Math.max(...all.map((t) => t.idx + t.weeks - 1));
  const nWeeks = maxIdx - minIdx + 1;
  const weeks = Array.from({ length: nWeeks }, (_, i) => minIdx + i);
  const MINCOL = 46, LABEL = 400;
  const grid = { display: "grid", gridTemplateColumns: `${LABEL}px repeat(${nWeeks}, minmax(${MINCOL}px, 1fr))` };
  const qSpans = [];
  weeks.forEach((w, i) => { const q = weekLabel(w).q; const last = qSpans[qSpans.length - 1]; if (last && last.q === q) last.len++; else qSpans.push({ q, start: i, len: 1 }); });
  return (
    <div style={{ overflow: "auto", maxHeight: 440 }}>
      <div style={{ minWidth: LABEL + nWeeks * MINCOL }}>
        <div style={{ position: "sticky", top: 0, zIndex: 4, background: T.surface }}>
        <div style={grid}>
          <div style={{ position: "sticky", left: 0, background: T.surface, zIndex: 2 }} />
          {qSpans.map((s) => <div key={s.q} style={{ gridColumn: `${2 + s.start} / span ${s.len}`, fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: T.inkSoft, borderLeft: `1px solid ${T.hairline}`, padding: "2px 0 2px 6px" }}>{s.q.toUpperCase()}</div>)}
        </div>
        <div style={{ ...grid, borderBottom: `1px solid ${T.hairline}` }}>
          <div style={{ position: "sticky", left: 0, background: T.surface, zIndex: 2, fontFamily: T.mono, fontSize: 10, color: T.inkSoft, padding: "2px 8px" }}>{labelHeader.toUpperCase()}</div>
          {weeks.map((w, i) => <div key={i} style={{ textAlign: "center", padding: "2px 0", borderLeft: weekLabel(w).wk === 1 ? `1px solid ${T.hairline}` : "none" }}><div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, color: T.ink }}>W{weekLabel(w).wk}</div><div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.inkSoft }}>{weekDate(w)}</div></div>)}
        </div>
        </div>
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && <div style={{ ...grid }}><div style={{ gridColumn: "1 / -1", position: "sticky", left: 0, background: T.paper, padding: "8px 8px 4px", fontFamily: T.display, fontWeight: 700, fontSize: 13, color: g.color || T.ink, borderTop: `1px solid ${T.hairline}` }}>{g.label}</div></div>}
            {g.tasks.map((t) => {
              const own = t.owner ? resourceLines(org, t.owner) : { team: "", people: "" };
              const dt = delivType(t.stretch);
              return (
                <div key={t.key} style={{ ...grid, alignItems: "center", borderTop: `1px solid ${T.hairlineSoft}` }}>
                  <button onClick={() => onOpen && onOpen(t.projectId)} title={dt.label} style={{ position: "sticky", left: 0, background: T.surface, zIndex: 1, textAlign: "left", border: "none", borderLeft: `4px solid ${dt.color}`, padding: "7px 8px 7px 9px", fontFamily: T.body, cursor: onOpen ? "pointer" : "default", overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: dt.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{t.deliverable}</span>
                    </div>
                    {own.team && <div style={{ fontSize: 11, color: t.ws.color, lineHeight: 1.3, marginLeft: 14 }}>{own.team}</div>}
                    {own.people && <div style={{ fontSize: 11, color: t.ws.color, lineHeight: 1.3, marginLeft: 14 }}>{own.people}</div>}
                  </button>
                  <div title={`${t.deliverable}${own.team ? " · " + own.team : ""}${own.people ? " · " + own.people : ""} · ${weekDate(t.idx)} → ${weekDate(t.idx + t.weeks - 1)} (${t.weeks}w)`} style={{ gridColumn: `${2 + (t.idx - minIdx)} / span ${t.weeks}`, gridRow: 1, alignSelf: "center", height: 20, background: t.ws.soft, border: `1px solid ${t.ws.color}`, borderLeft: `3px solid ${t.ws.color}`, borderRadius: 5, margin: "5px 2px" }} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- MASTER GANTT ---------- */
function Schedule({ projects, org, unlocked, onImport, onOpen }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const exportPlan = () => {
    const blob = new Blob([buildPlanToCsv(projects, org)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "revops-build-plan.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const exportTimeline = () => {
    const blob = new Blob([timelineToCsv(projects)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "revops-timeline.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const onFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => { try { setBusy(true); setMsg(""); const n = await onImport(String(rd.result || "")); setMsg(`Imported ${n} scheduled deliverable${n === 1 ? "" : "s"}.`); } catch (err) { setMsg(err.message); } finally { setBusy(false); } };
    rd.readAsText(f); e.target.value = "";
  };

  const groups = projects.map((p) => {
    const ws = wsMeta(p.workstream); const tasks = projectTasks(p); if (!tasks.length) return null;
    return { p, ws, tasks, gMin: Math.min(...tasks.map((t) => t.idx)), gMax: Math.max(...tasks.map((t) => t.idx + t.weeks - 1)) };
  }).filter(Boolean);
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const allOpen = groups.length > 0 && groups.every((g) => expanded[g.p.id]);

  const controls = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {groups.length > 0 && <button onClick={() => { const next = {}; groups.forEach((g) => { next[g.p.id] = !allOpen; }); setExpanded(next); }} style={btnGhost}>{allOpen ? "Collapse all" : "Expand all"}</button>}
      <button onClick={exportTimeline} disabled={!groups.length} style={{ ...btnGhost, opacity: groups.length ? 1 : 0.5 }}>↓ Export timeline</button>
      <button onClick={exportPlan} disabled={!projects.length} style={btnGhost} title="Blank scaffold: one row per deliverable to fill in">↓ Export build-plan scaffold</button>
      {unlocked && <label style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>↑ Import (all projects)<input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} /></label>}
      {busy && <span style={{ fontSize: 12, color: T.inkSoft }}>Importing…</span>}
      {msg && <span style={{ fontSize: 12, color: msg.startsWith("Imported") ? "#0E8A74" : "#A33D3D" }}>{msg}</span>}
    </div>
  );

  const all = groups.flatMap((g) => g.tasks);
  const minIdx = all.length ? Math.min(...all.map((t) => t.idx)) : 0, maxIdx = all.length ? Math.max(...all.map((t) => t.idx + t.weeks - 1)) : 0;
  const nWeeks = maxIdx - minIdx + 1;
  const weeks = Array.from({ length: nWeeks }, (_, i) => minIdx + i);
  const COL = 40, LABEL = 440;
  const grid = { display: "grid", gridTemplateColumns: `${LABEL}px repeat(${nWeeks}, ${COL}px)` };
  const qSpans = [];
  weeks.forEach((w, i) => { const q = weekLabel(w).q; const last = qSpans[qSpans.length - 1]; if (last && last.q === q) last.len++; else qSpans.push({ q, start: i, len: 1 }); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <div><h2 style={{ ...h2Style, marginBottom: 2 }}>Timeline</h2><p style={{ fontSize: 12.5, color: T.inkSoft, margin: 0 }}>One overall bar per project across the timeline. Click a project (its row or bar) to break it out into deliverables.</p></div>
        {controls}
      </div>
      {groups.length > 0 && <GanttLegend />}
      {groups.length ? (
        <div style={{ background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 12, overflow: "auto", maxHeight: "72vh" }}>
          <div style={{ minWidth: LABEL + nWeeks * COL }}>
            <div style={{ position: "sticky", top: 0, zIndex: 4, background: T.surface }}>
            <div style={grid}>
              <div style={{ position: "sticky", left: 0, background: T.surface, zIndex: 2 }} />
              {qSpans.map((s) => <div key={s.q} style={{ gridColumn: `${2 + s.start} / span ${s.len}`, fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: T.inkSoft, borderLeft: `1px solid ${T.hairline}`, padding: "2px 0 2px 6px" }}>{s.q.toUpperCase()}</div>)}
            </div>
            <div style={{ ...grid, borderBottom: `1px solid ${T.hairline}` }}>
              <div style={{ position: "sticky", left: 0, background: T.surface, zIndex: 2, fontFamily: T.mono, fontSize: 10, color: T.inkSoft, padding: "2px 8px" }}>PROJECT</div>
              {weeks.map((w, i) => <div key={i} style={{ textAlign: "center", padding: "2px 0", borderLeft: weekLabel(w).wk === 1 ? `1px solid ${T.hairline}` : "none" }}><div style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, color: T.ink }}>W{weekLabel(w).wk}</div><div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.inkSoft }}>{weekDate(w)}</div></div>)}
            </div>
            </div>
            {groups.map((g) => {
              const isOpen = !!expanded[g.p.id];
              return (
                <div key={g.p.id}>
                  <div style={{ ...grid, alignItems: "center", borderTop: `1px solid ${T.hairline}` }}>
                    <button onClick={() => toggle(g.p.id)} style={{ position: "sticky", left: 0, background: T.surface, zIndex: 1, textAlign: "left", border: "none", padding: "8px 8px", cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      <span style={{ color: T.inkSoft, marginRight: 5 }}>{isOpen ? "▾" : "▸"}</span>
                      <span style={{ fontFamily: T.mono, fontWeight: 700, color: g.ws.color, fontSize: 11 }}>{g.p.code}</span>
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: T.ink, marginLeft: 6 }}>{g.p.title}</span>
                      <span style={{ fontSize: 11, color: T.inkSoft, marginLeft: 6 }}>· {g.tasks.length}</span>
                    </button>
                    <button onClick={() => toggle(g.p.id)} title={`${g.p.code} · ${g.tasks.length} deliverables · ${weekLabel(g.gMin).q} W${weekLabel(g.gMin).wk} → ${weekLabel(g.gMax).q} W${weekLabel(g.gMax).wk}`} style={{ gridColumn: `${2 + (g.gMin - minIdx)} / span ${g.gMax - g.gMin + 1}`, gridRow: 1, alignSelf: "center", height: 24, background: g.ws.soft, border: `1px solid ${g.ws.color}`, borderLeft: `3px solid ${g.ws.color}`, borderRadius: 6, color: g.ws.color, fontFamily: T.mono, fontSize: 11, fontWeight: 700, padding: "0 8px", textAlign: "left", overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", margin: "4px 2px" }}>{g.p.code}</button>
                  </div>
                  {isOpen && g.tasks.map((t) => {
                    const own = t.owner ? resourceLines(org, t.owner) : { team: "", people: "" };
                    const dt = delivType(t.stretch);
                    return (
                    <div key={t.key} style={{ ...grid, alignItems: "center", borderTop: `1px solid ${T.hairlineSoft}` }}>
                      <button onClick={() => onOpen(g.p.id)} title={dt.label} style={{ position: "sticky", left: 0, background: T.surface, zIndex: 1, textAlign: "left", border: "none", borderLeft: `4px solid ${dt.color}`, padding: "6px 8px 6px 22px", cursor: "pointer", overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 3, background: dt.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>{t.deliverable}</span>
                        </div>
                        {own.team && <div style={{ fontSize: 10.5, color: g.ws.color, lineHeight: 1.3, marginLeft: 14 }}>{own.team}</div>}
                        {own.people && <div style={{ fontSize: 10.5, color: g.ws.color, lineHeight: 1.3, marginLeft: 14 }}>{own.people}</div>}
                      </button>
                      <div title={`${t.deliverable}${own.team ? " · " + own.team : ""}${own.people ? " · " + own.people : ""} · ${weekDate(t.idx)} → ${weekDate(t.idx + t.weeks - 1)} (${t.weeks}w)`} style={{ gridColumn: `${2 + (t.idx - minIdx)} / span ${t.weeks}`, gridRow: 1, alignSelf: "center", height: 16, background: g.ws.soft, border: `1px solid ${g.ws.color}`, borderLeft: `3px solid ${g.ws.color}`, borderRadius: 4, margin: "4px 2px" }} />
                    </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ background: T.paper, border: `1px dashed ${T.hairline}`, borderRadius: 12, padding: "26px 22px", color: T.inkSoft, fontSize: 13, lineHeight: 1.6, maxWidth: 780 }}>
          <strong style={{ color: T.ink }}>No deliverable timelines yet.</strong> Two ways to populate:
          <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            <li>Open a project (unlock first) and <strong>Import timeline CSV</strong> for just that project, or</li>
            <li><strong>Export build plan</strong> here, fill <code style={codeChip}>owner</code> / <code style={codeChip}>start</code> (e.g. <code style={codeChip}>Q3 2026 W2</code>) / <code style={codeChip}>weeks</code> for every deliverable, then <strong>Import (all projects)</strong>.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------- TIMELINE IMPORT MODAL (paste or file) ---------- */
function TimelineImportModal({ heading, deliverables, onClose, onApply }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const parsed = useMemo(() => parseTasksCsv(text), [text]);
  const delSet = useMemo(() => new Set((deliverables || []).map((d) => normDel(d.text))), [deliverables]);
  const unmatched = parsed.tasks.filter((t) => !delSet.has(normDel(t.deliverable)));
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { setText(String(rd.result || "")); setErr(""); }; rd.readAsText(f); e.target.value = ""; };
  const apply = () => { if (!parsed.tasks.length) { setErr(parsed.error || "Nothing to import."); return; } onApply(parsed.tasks); };
  const field = { fontFamily: T.body, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, width: "100%" };
  const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft, marginBottom: 5, display: "block" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(640px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <h2 style={{ ...h2Style, marginTop: 0 }}>{heading || "Import timeline"}</h2>
        <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "6px 0 14px" }}>Paste CSV or upload a file. Columns: <code style={codeChip}>deliverable, owner, start, weeks</code> (optional <code style={codeChip}>hours</code> 10/20/40/60/80) — <code style={codeChip}>start</code> like <code style={codeChip}>Q3 2026 W2</code> (W1–W13 in a quarter), <code style={codeChip}>weeks</code> = duration. The <code style={codeChip}>owner</code> should be a roster team or its lead — it drives that team's hours in Resourcing.</p>
        <label style={lbl}>UPLOAD .CSV</label>
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 12.5, marginBottom: 10 }} />
        <label style={lbl}>OR PASTE CSV</label>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} rows={8} placeholder={"deliverable,owner,start,weeks\nCreate + populate field,Business Systems · HubSpot,Q3 2026 W1,1"} style={{ ...field, fontFamily: T.mono, fontSize: 12, lineHeight: 1.5, resize: "vertical" }} />
        <div style={{ fontSize: 12.5, color: parsed.error ? "#A33D3D" : T.inkSoft, margin: "8px 0 0" }}>{text.trim() ? (parsed.error || `${parsed.tasks.length} row${parsed.tasks.length === 1 ? "" : "s"} ready — ${parsed.tasks.length - unmatched.length} match this project's deliverables.`) : "Waiting for CSV…"}</div>
        {unmatched.length > 0 && <div style={{ fontSize: 12, color: "#9A6A12", margin: "6px 0 0" }}>⚠ {unmatched.length} row{unmatched.length === 1 ? "" : "s"} don't match a deliverable and will show as extra rows: {unmatched.slice(0, 4).map((t) => t.deliverable).join(" · ")}{unmatched.length > 4 ? "…" : ""}</div>}
        {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={apply} disabled={!parsed.tasks.length} style={{ ...btnSolid, opacity: parsed.tasks.length ? 1 : 0.5 }}>Import {parsed.tasks.length || ""} deliverable{parsed.tasks.length === 1 ? "" : "s"}</button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- ROSTER IMPORT MODAL (replace the whole org from CSV) ---------- */
function RosterImportModal({ onClose, onApply }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const parsed = useMemo(() => csvToOrg(text), [text]);
  const teams = parsed.org ? parsed.org.reduce((s, g) => s + g.members.length + g.members.reduce((a, m) => a + ((m.sub || []).length), 0), 0) : 0;
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { setText(String(rd.result || "")); setErr(""); }; rd.readAsText(f); e.target.value = ""; };
  const apply = async () => {
    if (!parsed.org || !parsed.count) { setErr(parsed.error || "Nothing to import."); return; }
    if (!window.confirm(`Replace the entire roster with ${parsed.org.length} group(s) / ${teams} team(s)? This overwrites the current roster.`)) return;
    setBusy(true); setErr("");
    try { await onApply(parsed.org); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const field = { fontFamily: T.body, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, width: "100%" };
  const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft, marginBottom: 5, display: "block" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(640px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <h2 style={{ ...h2Style, marginTop: 0 }}>Import roster</h2>
        <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "6px 0 14px" }}>Paste or upload a roster CSV — same columns as <strong>Export roster</strong>: <code style={codeChip}>group, team, parent, lead, pm, cap</code>. One row per team. Leave <code style={codeChip}>parent</code> blank for a top-level team; set it to a team's name to nest a sub-team under it. <code style={codeChip}>cap</code> is that team's capacity hours/quarter (optional — omit the column to keep current caps). This <strong>replaces the entire roster</strong>.</p>
        <label style={lbl}>UPLOAD .CSV</label>
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 12.5, marginBottom: 10 }} />
        <label style={lbl}>OR PASTE CSV</label>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} rows={8} placeholder={"group,team,parent,lead,pm,cap\nOperations,Finance,,Chrissy Lo,Robin Soukup,240\nContractors,HubSpot,,Empty Cup Digital,,240"} style={{ ...field, fontFamily: T.mono, fontSize: 12, lineHeight: 1.5, resize: "vertical" }} />
        <div style={{ fontSize: 12.5, color: parsed.error ? "#A33D3D" : T.inkSoft, margin: "8px 0 0" }}>{text.trim() ? (parsed.error || `${parsed.org.length} group${parsed.org.length === 1 ? "" : "s"}, ${teams} team${teams === 1 ? "" : "s"} ready: ${parsed.org.map((g) => g.name).join(", ")}`) : "Waiting for CSV…"}</div>
        {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={apply} disabled={busy || !parsed.count} style={{ ...btnSolid, opacity: busy || !parsed.count ? 0.5 : 1 }}>{busy ? "Importing…" : `Replace roster (${teams || ""})`}</button>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- ADD MODAL ---------- */
function AddModal({ onClose, onAdd, onImport, existing, workstreams }) {
  const [mode, setMode] = useState("single");
  const [f, setF] = useState({ title: "", workstream: "Marketing Services", effort: "M", impact: 3, targetWindow: "Q3 2026", dri: "", problem: "", solution: "" });
  const [csv, setCsv] = useState("");
  const [upsert, setUpsert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const parsed = useMemo(() => csvToProjects(csv, existing, upsert), [csv, existing, upsert]);
  const total = parsed.creates.length + parsed.updates.length;

  const submitSingle = () => {
    if (!f.title.trim()) { setErr("Title is required."); return; }
    if (!f.workstream.trim()) { setErr("Workstream is required."); return; }
    const base = f.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "project";
    let id = base, n = 2; while (existing.some((p) => p.id === id)) { id = `${base}-${n++}`; }
    const obj = {
      id, code: nextCode(f.workstream.trim(), existing, id), title: f.title.trim(), workstream: f.workstream.trim(),
      stakeholder: "", dri: f.dri, targetWindow: f.targetWindow, problem: f.problem, solution: f.solution, success: "",
      deliverables: [], roles: [], dependsOn: [], openItems: [], impact: Number(f.impact), effort: f.effort,
    };
    onAdd(obj).then(() => onClose()).catch((e) => setErr(e.message));
  };
  const submitCsv = () => {
    if (!total) { setErr(parsed.error || "Nothing to import."); return; }
    setBusy(true); setErr("");
    onImport(parsed.creates, parsed.updates).then(() => onClose()).catch((e) => { setErr(e.message); setBusy(false); });
  };
  const onFile = (e) => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => setCsv(String(rd.result || "")); rd.readAsText(file); };

  const field = { fontFamily: T.body, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, width: "100%" };
  const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: "0.08em", color: T.inkSoft, marginBottom: 5, display: "block" };
  const tab = (k, label) => <button onClick={() => { setMode(k); setErr(""); }} style={{ fontFamily: T.body, fontSize: 13, fontWeight: mode === k ? 600 : 500, padding: "7px 14px", background: "none", border: "none", color: mode === k ? T.ink : T.inkSoft, borderBottom: mode === k ? `2px solid ${T.ink}` : "2px solid transparent" }}>{label}</button>;
  const wsAll = Array.from(new Set([f.workstream, ...workstreams].filter(Boolean)));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,37,33,.32)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: "min(660px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 26, fontFamily: T.body }}>
        <h2 style={{ ...h2Style, marginTop: 0 }}>Add projects</h2>
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.hairline}`, margin: "12px 0 18px" }}>{tab("single", "Single project")}{tab("csv", "CSV upload")}</div>

        {mode === "single" ? (
          <>
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 16px" }}>Fill the essentials — deliverables, team, dependencies, and risks are editable inline on the project once it opens. The project code comes from the workstream.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={lbl}>TITLE</label><input value={f.title} onChange={(e) => { set("title", e.target.value); setErr(""); }} placeholder="Project title" style={field} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>WORKSTREAM</label>
                  <select value={f.workstream} onChange={(e) => { if (e.target.value === "__new__") { const v = window.prompt("New workstream name:"); if (v && v.trim()) set("workstream", v.trim()); } else set("workstream", e.target.value); }} style={field}>
                    {wsAll.map((w) => <option key={w} value={w}>{w}</option>)}<option value="__new__">+ New workstream…</option>
                  </select>
                </div>
                <div><label style={lbl}>TARGET</label><select value={f.targetWindow} onChange={(e) => set("targetWindow", e.target.value)} style={field}>{TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>EFFORT</label><select value={f.effort} onChange={(e) => set("effort", e.target.value)} style={field}>{EFFORTS.map((s) => <option key={s} value={s}>{s} · {EFFORT_POINTS[s]}u</option>)}</select></div>
                <div><label style={lbl}>IMPACT</label><select value={f.impact} onChange={(e) => set("impact", e.target.value)} style={field}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              </div>
              <div><label style={lbl}>DRI (optional)</label><input value={f.dri} onChange={(e) => set("dri", e.target.value)} placeholder="Accountable owner" style={field} /></div>
              <div><label style={lbl}>THE PROBLEM</label><textarea value={f.problem} onChange={(e) => set("problem", e.target.value)} rows={3} placeholder="The pain, who feels it, what it costs" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} /></div>
              <div><label style={lbl}>THE SOLUTION</label><textarea value={f.solution} onChange={(e) => set("solution", e.target.value)} rows={3} placeholder="The approach in plain language" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} /></div>
            </div>
            {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "12px 0 0" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}><button onClick={submitSingle} style={btnSolid}>Create & edit</button><button onClick={onClose} style={btnGhost}>Cancel</button></div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>Upload or paste CSV to add or update many projects at once. Hand the format below to your planning agent so its output drops straight in.</p>
            <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, lineHeight: 1.6, color: T.inkSoft }}>
              <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: "0.08em", color: T.ink, marginBottom: 6 }}>CSV FORMAT</div>
              <div>One row per project. Header columns (any order; extras ignored): <span style={{ fontFamily: T.mono, color: T.ink }}>{CSV_COLUMNS.join(", ")}</span>.</div>
              <div style={{ marginTop: 6 }}>Only <strong>title</strong> is required for new projects. <strong>effort</strong> ∈ XS/S/M/L/XL; <strong>impact</strong> 1–5; <strong>workstream</strong> is free text (new ones fine). The project code is derived from the workstream.</div>
              <div style={{ marginTop: 6 }}><strong>Updating:</strong> with the toggle on, any row whose <code style={codeChip}>code</code> matches an existing project updates it in place (no duplicate) — and only the columns you include are changed, so a partial CSV (e.g. just <code style={codeChip}>code,target</code>) leaves everything else intact.</div>
              <div style={{ marginTop: 6 }}>List cells separate items with <code style={codeChip}>|</code> and sub-fields with <code style={codeChip}>::</code> —</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                <li><strong>deliverables</strong>: <code style={codeChip}>Build X | *Stretch item</code> (prefix <code style={codeChip}>*</code> = stretch)</li>
                <li><strong>team</strong>: <code style={codeChip}>Business Systems :: Builds it :: L | HubSpot :: HubSpot work :: M</code> (name :: what :: that team's effort)</li>
                <li><strong>dependsOn</strong>: <code style={codeChip}>SUP-01 :: why it's needed</code></li>
                <li><strong>openItems</strong>: <code style={codeChip}>Risk one | Assumption two</code></li>
              </ul>
              <button onClick={() => setCsv(CSV_TEMPLATE)} style={{ ...addBtn, marginTop: 10 }}>Load example row</button>
            </div>
            <label style={lbl}>UPLOAD .CSV</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 12.5, marginBottom: 10 }} />
            <label style={lbl}>OR PASTE CSV</label>
            <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setErr(""); }} rows={8} placeholder="code,title,workstream,effort,impact,..." style={{ ...field, fontFamily: T.mono, fontSize: 12, lineHeight: 1.5, resize: "vertical" }} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0 0", fontSize: 12.5, color: T.ink, cursor: "pointer" }}>
              <input type="checkbox" checked={upsert} onChange={(e) => setUpsert(e.target.checked)} />
              Update existing projects when <code style={codeChip}>code</code> matches <span style={{ color: T.inkSoft }}>(otherwise every row is added as new)</span>
            </label>
            <div style={{ fontSize: 12.5, color: parsed.error ? "#A33D3D" : T.inkSoft, margin: "8px 0 0" }}>{csv.trim() ? (parsed.error || `Ready: ${parsed.creates.length} new${parsed.updates.length ? `, ${parsed.updates.length} to update (${parsed.updates.map((u) => u._code).join(", ")})` : ""}`) : "Waiting for CSV…"}</div>
            {err && <p style={{ color: "#A33D3D", fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button onClick={submitCsv} disabled={busy || !total} style={{ ...btnSolid, opacity: busy || !total ? 0.5 : 1 }}>{busy ? "Importing…" : `Import ${total || ""} project${total === 1 ? "" : "s"}`}</button><button onClick={onClose} style={btnGhost}>Cancel</button></div>
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
const xBtn = { background: "none", border: "none", color: T.inkSoft, fontSize: 12, padding: "2px 4px", flexShrink: 0 };
const addBtn = { alignSelf: "flex-start", background: "none", border: `1px dashed ${T.hairline}`, color: T.inkSoft, fontFamily: T.body, fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 8 };
const codeChip = { fontFamily: T.mono, fontSize: 11.5, background: T.hairlineSoft, color: T.ink, padding: "1px 5px", borderRadius: 4 };

function SectionTitle({ children }) { return <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkSoft }}>{children}</span>; }
function Empty() { return <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkSoft, fontSize: 14 }}>Nothing here yet.</div>; }
