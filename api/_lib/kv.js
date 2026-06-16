import { put, list } from "@vercel/blob";

/* Single-file storage. We NEVER delete blobs (deletes previously caused data loss).
   Reads pick the newest version of the file and fetch it cache-busted so they're fresh. */
const PROJECTS = "projects.json";
const SETTINGS = "settings.json";
const token = () => process.env.BLOB_READ_WRITE_TOKEN;
function freshUrl(u) { return u + (u.includes("?") ? "&" : "?") + "cb=" + Date.now(); }

async function readOne(pathname, fallback) {
  const { blobs } = await list({ prefix: pathname, token: token() });
  const matches = blobs.filter((b) => b.pathname === pathname);
  if (!matches.length) return fallback;
  matches.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const res = await fetch(freshUrl(matches[0].url), { cache: "no-store" });
  return await res.json();
}

async function writeOne(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    token: token(),
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

export async function getProjects() { try { return await readOne(PROJECTS, []); } catch { return []; } }
export async function saveProjects(projects) { await writeOne(PROJECTS, projects); }
export async function getSettings() { try { return await readOne(SETTINGS, {}); } catch { return {}; } }
export async function saveSettings(obj) { await writeOne(SETTINGS, obj || {}); }

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
