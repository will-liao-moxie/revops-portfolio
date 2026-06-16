import { put, list, del } from "@vercel/blob";

/* Vercel Blob serves public URLs through a CDN that caches the fixed pathname and
   ignores cache-busting query params — so overwriting a single file (projects.json)
   yields stale reads. Instead we write each update to a NEW versioned URL (never
   cached → always fresh) and read the newest version, cleaning up old ones. */
const PROJECTS_PREFIX = "projects-v/";
const SETTINGS_PREFIX = "settings-v/";
const LEGACY = { [PROJECTS_PREFIX]: "projects.json", [SETTINGS_PREFIX]: "settings.json" };
const token = () => process.env.BLOB_READ_WRITE_TOKEN;

async function readLatest(prefix, fallback) {
  const { blobs } = await list({ prefix, token: token() });
  if (blobs.length) {
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return await res.json();
  }
  // migrate-on-read from the legacy single-file path, if present
  const legacy = LEGACY[prefix];
  if (legacy) {
    const { blobs: lb } = await list({ prefix: legacy, token: token() });
    const m = lb.find((b) => b.pathname === legacy);
    if (m) { const res = await fetch(m.url + "?cb=" + Date.now(), { cache: "no-store" }); return await res.json(); }
  }
  return fallback;
}

async function writeLatest(prefix, data) {
  const res = await put(`${prefix}${Date.now()}.json`, JSON.stringify(data), {
    access: "public", contentType: "application/json", token: token(), addRandomSuffix: true,
  });
  // best-effort: drop all older versions (and the legacy file) so reads stay cheap
  try {
    const { blobs } = await list({ prefix, token: token() });
    const stale = blobs.filter((b) => b.url !== res.url).map((b) => b.url);
    const legacy = LEGACY[prefix];
    if (legacy) { const { blobs: lb } = await list({ prefix: legacy, token: token() }); lb.forEach((b) => { if (b.pathname === legacy) stale.push(b.url); }); }
    if (stale.length) await del(stale, { token: token() });
  } catch {}
  return res;
}

export async function getProjects() {
  try { return await readLatest(PROJECTS_PREFIX, []); } catch { return []; }
}
export async function saveProjects(projects) {
  await writeLatest(PROJECTS_PREFIX, projects);
}
export async function getSettings() {
  try { return await readLatest(SETTINGS_PREFIX, {}); } catch { return {}; }
}
export async function saveSettings(obj) {
  await writeLatest(SETTINGS_PREFIX, obj || {});
}

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
