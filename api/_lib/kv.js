import { put, list } from "@vercel/blob";

/* Each save writes a NEW uniquely-named blob (unique URL = never CDN-cached = always
   fresh on read). Reads pick the newest version by the ms timestamp in the pathname.
   We APPEND ONLY — never delete — so a stale/empty write can never wipe history.
   (A fixed filename can't be used: Vercel's CDN serves stale copies of a fixed URL.) */
const PROJECTS_PREFIX = "projects-v/";
const SETTINGS_PREFIX = "settings-v/";
const LEGACY = { [PROJECTS_PREFIX]: "projects.json", [SETTINGS_PREFIX]: "settings.json" };
const token = () => process.env.BLOB_READ_WRITE_TOKEN;
function ver(b) { const m = (b.pathname || "").match(/(\d{10,})/); return m ? Number(m[1]) : new Date(b.uploadedAt).getTime(); }

async function readLatest(prefix, fallback) {
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

async function writeLatest(prefix, data) {
  await put(`${prefix}${Date.now()}.json`, JSON.stringify(data), {
    access: "public", contentType: "application/json", token: token(), addRandomSuffix: true,
  });
}

export async function getProjects() { try { return await readLatest(PROJECTS_PREFIX, []); } catch { return []; } }
export async function saveProjects(projects) { await writeLatest(PROJECTS_PREFIX, projects); }
export async function getSettings() { try { return await readLatest(SETTINGS_PREFIX, {}); } catch { return {}; } }
export async function saveSettings(obj) { await writeLatest(SETTINGS_PREFIX, obj || {}); }

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
