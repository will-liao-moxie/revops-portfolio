import { put, head, getDownloadUrl } from "@vercel/blob";

const BLOB_PATHNAME = "projects.json";

export function requireEditKey(req, res) {
  const key = process.env.EDIT_KEY;
  if (!key) return true;
  if (req.headers["x-edit-key"] === key) return true;
  res.status(401).json({ error: "Edit key required" });
  return false;
}

export async function getProjects() {
  try {
    const blob = await head(BLOB_PATHNAME, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const res = await fetch(blob.url);
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveProjects(projects) {
  await put(BLOB_PATHNAME, JSON.stringify(projects), {
    access: "public",
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  });
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}
