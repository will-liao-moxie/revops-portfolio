import { google } from "googleapis";

export const TAB = "Projects";

export const HEADERS = [
  "id", "code", "title", "workstream", "status", "impact", "effort",
  "stakeholder", "revopsRole", "devResources",
  "problem", "solution", "success",
  "teams", "contractors", "deliverables", "roles", "dependsOn", "openItems",
  "docUrl",
];

const JSON_FIELDS = new Set(["teams", "contractors", "deliverables", "roles", "dependsOn", "openItems"]);
const NUM_FIELDS = new Set(["impact", "effort"]);

export function getSheets() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const sheetId = process.env.SHEET_ID;
  if (!email || !key || !sheetId) {
    throw new Error("Missing env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and SHEET_ID are required");
  }
  const auth = new google.auth.JWT(email, null, key, ["https://www.googleapis.com/auth/spreadsheets"]);
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

export function rowToProject(header, row) {
  const p = {};
  header.forEach((h, i) => {
    let v = row[i] ?? "";
    if (JSON_FIELDS.has(h)) {
      try { v = v ? JSON.parse(v) : []; } catch { v = []; }
    } else if (NUM_FIELDS.has(h)) {
      v = Number(v) || 0;
    }
    p[h] = v;
  });
  return p;
}

export function projectToRow(p) {
  return HEADERS.map((h) => {
    const v = p[h];
    if (JSON_FIELDS.has(h)) return JSON.stringify(v ?? []);
    return v == null ? "" : String(v);
  });
}

/**
 * If EDIT_KEY is set in env, writes require an x-edit-key header that matches.
 * If EDIT_KEY is not set, writes are open (fine behind Vercel team auth; set the
 * key if the deployment URL is reachable by anyone outside the team).
 */
export function requireEditKey(req, res) {
  const key = process.env.EDIT_KEY;
  if (!key) return true;
  if (req.headers["x-edit-key"] === key) return true;
  res.status(401).json({ error: "Edit key required" });
  return false;
}

export function colLetter(index) {
  let s = "";
  let i = index + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export function parseBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}
