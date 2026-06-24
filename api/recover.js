import { list, put } from "@vercel/blob";

/* Diagnostic + recovery for the append-only state store.
   GET  -> list recent versions with their project counts (newest first)
   POST -> re-save the newest version that has projects (or ?source=projects-v to pull legacy)
   Edit-key protected. Append-only: recovery writes a NEW version, never deletes. */
const token = () => process.env.BLOB_READ_WRITE_TOKEN;
function ver(b) { const m = (b.pathname || "").match(/(\d{10,})/); return m ? Number(m[1]) : new Date(b.uploadedAt).getTime(); }

async function versions(prefix) {
  const { blobs } = await list({ prefix, token: token() });
  blobs.sort((a, b) => ver(b) - ver(a));
  return blobs;
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const key = process.env.EDIT_KEY;
    if (key && req.headers["x-edit-key"] !== key) return res.status(401).json({ error: "Edit key required" });

    const stateBlobs = await versions("state-v/");

    if (req.method === "GET") {
      const out = [];
      for (const b of stateBlobs.slice(0, 12)) {
        const row = { pathname: b.pathname, ts: ver(b), url: b.url };
        try { const r = await fetch(b.url, { cache: "no-store" }); row.status = r.status; if (r.ok) { const j = await r.json(); row.projects = (j.projects || []).length; row.settingsKeys = Object.keys(j.settings || {}).length; } else { row.body = (await r.text()).slice(0, 120); } }
        catch (e) { row.fetchError = String(e.message || e); }
        out.push(row);
      }
      const legacyP = await versions("projects-v/");
      const legacyRows = [];
      for (const b of legacyP.slice(0, 6)) {
        const row = { pathname: b.pathname, ts: ver(b) };
        try { const r = await fetch(b.url, { cache: "no-store" }); row.status = r.status; if (r.ok) { const j = await r.json(); row.projects = (j || []).length; } }
        catch (e) { row.fetchError = String(e.message || e); }
        legacyRows.push(row);
      }
      return res.status(200).json({ stateCount: stateBlobs.length, stateVersions: out, legacyProjectsVersions: legacyRows });
    }

    if (req.method === "POST") {
      // find newest state-v version with projects
      for (const b of stateBlobs) {
        try {
          const r = await fetch(b.url, { cache: "no-store" }); const j = await r.json();
          if ((j.projects || []).length) {
            await put(`state-v/${Date.now()}.json`, JSON.stringify({ projects: j.projects || [], settings: j.settings || {} }), { access: "public", contentType: "application/json", token: token(), addRandomSuffix: true });
            return res.status(200).json({ ok: true, recovered: j.projects.length, settingsKeys: Object.keys(j.settings || {}).length, from: b.pathname });
          }
        } catch { /* try older */ }
      }
      // fall back to legacy projects-v / settings-v
      try {
        const lp = await versions("projects-v/"); const ls = await versions("settings-v/");
        const projects = lp.length ? await (await fetch(lp[0].url, { cache: "no-store" })).json() : [];
        const settings = ls.length ? await (await fetch(ls[0].url, { cache: "no-store" })).json() : {};
        if ((projects || []).length) {
          await put(`state-v/${Date.now()}.json`, JSON.stringify({ projects, settings: settings || {} }), { access: "public", contentType: "application/json", token: token(), addRandomSuffix: true });
          return res.status(200).json({ ok: true, recovered: projects.length, settingsKeys: Object.keys(settings || {}).length, from: "legacy projects-v/" });
        }
      } catch { /* ignore */ }
      return res.status(404).json({ error: "No non-empty version found in state-v/ or legacy stores" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
