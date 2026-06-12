import { kv } from "@vercel/kv";

export const PROJECTS_KEY = "projects";

export function requireEditKey(req, res) {
  const key = process.env.EDIT_KEY;
  if (!key) return true;
  if (req.headers["x-edit-key"] === key) return true;
  res.status(401).json({ error: "Edit key required" });
  return false;
}

export async function getProjects() {
  return (await kv.get(PROJECTS_KEY)) || [];
}

export async function saveProjects(projects) {
  await kv.set(PROJECTS_KEY, projects);
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}
