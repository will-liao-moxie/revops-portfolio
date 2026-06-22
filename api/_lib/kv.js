import { put, list } from "@vercel/blob";

/* Combined state lives in ONE append-only versioned store: state-v/<ms>.json holds
   { projects, settings }. Reads do a single list() (Advanced op) instead of one per
   collection — halving advanced-operation usage on the hot read path. We APPEND ONLY,
   never delete, so a stale/empty write can never wipe history.
   (A fixed filename can't be used: Vercel's CDN serves stale copies of a fixed URL.) */
const STATE_PREFIX = "state-v/";
/* legacy split stores — migrated-on-read the first time, then state-v/ is the source of truth */
const OLD_PROJECTS = "projects-v/";
const OLD_SETTINGS = "settings-v/";
const LEGACY = { [OLD_PROJECTS]: "projects.json", [OLD_SETTINGS]: "settings.json" };
const token = () => process.env.BLOB_READ_WRITE_TOKEN;
function ver(b) { const m = (b.pathname || "").match(/(\d{10,})/); return m ? Number(m[1]) : new Date(b.uploadedAt).getTime(); }

async function readPrefix(prefix, fallback) {
  const { blobs } = await list({ prefix, token: token() });
  if (blobs.length) {
    blobs.sort((a, b) => ver(b) - ver(a));
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return await res.json();
  }
  // migrate-on-read from the legacy single-file path
  const legacy = LEGACY[prefix];
  if (legacy) {
    const { blobs: lb } = await list({ prefix: legacy, token: token() });
    const m = lb.filter((b) => b.pathname === legacy).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    if (m) { const res = await fetch(m.url + "?cb=" + Date.now(), { cache: "no-store" }); return await res.json(); }
  }
  return fallback;
}

async function writeState(state) {
  await put(`${STATE_PREFIX}${Date.now()}.json`, JSON.stringify(state), {
    access: "public", contentType: "application/json", token: token(), addRandomSuffix: true,
  });
}

/* Read the combined {projects, settings}. One list() in the steady state. The first time
   (no state-v/ yet) it migrates the old split stores and persists them, so later reads are
   single-list again. */
export async function getState() {
  try {
    const { blobs } = await list({ prefix: STATE_PREFIX, token: token() });
    if (blobs.length) {
      blobs.sort((a, b) => ver(b) - ver(a));
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      const s = await res.json();
      return { projects: s.projects || [], settings: s.settings || {} };
    }
    const projects = (await readPrefix(OLD_PROJECTS, [])) || [];
    const settings = (await readPrefix(OLD_SETTINGS, {})) || {};
    const migrated = { projects, settings };
    if (projects.length || Object.keys(settings).length) { try { await writeState(migrated); } catch { /* best-effort */ } }
    return migrated;
  } catch { return { projects: [], settings: {} }; }
}

export async function saveState(state) {
  await writeState({ projects: state.projects || [], settings: state.settings || {} });
}

/* compatibility helpers (each still single-list + single-put) */
export async function getProjects() { return (await getState()).projects; }
export async function saveProjects(projects) { const s = await getState(); await saveState({ ...s, projects }); }
export async function getSettings() { return (await getState()).settings; }
export async function saveSettings(settings) { const s = await getState(); await saveState({ ...s, settings }); }

export function requireEditKey(req, res) {
  const key = process.env.EDIT_KEY;
  if (!key) return true;
  if (req.headers["x-edit-key"] === key) return true;
  res.status(401).json({ error: "Edit key required" });
  return false;
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}
