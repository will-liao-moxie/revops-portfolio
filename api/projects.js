import { requireEditKey, parseBody, getState, saveState } from "./_lib/kv.js";

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method === "GET") {
      return res.status(200).json((await getState()).projects);
    }

    if (!requireEditKey(req, res)) return;
    const body = parseBody(req);
    const state = await getState();
    const projects = state.projects;

    if (req.method === "POST") {
      if (!body.id || !body.title || !body.workstream) {
        return res.status(400).json({ error: "id, title, and workstream are required" });
      }
      if (projects.some((p) => p.id === body.id)) {
        return res.status(409).json({ error: `A project with id "${body.id}" already exists — pick a new code` });
      }
      const project = { impact: 3, effort: "M", ...body };
      const next = [...projects, project];
      await saveState({ ...state, projects: next });
      return res.status(200).json({ ok: true, projects: next });
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const idx = projects.findIndex((p) => p.id === id);
      if (idx < 0) return res.status(404).json({ error: `Project "${id}" not found` });
      const next = projects.slice();
      next[idx] = { ...next[idx], ...patch };
      await saveState({ ...state, projects: next });
      return res.status(200).json({ ok: true, projects: next });
    }

    if (req.method === "PUT") {
      // bulk upsert: apply all creates + updates in ONE read-modify-write (vs. a request per row)
      const creates = Array.isArray(body.creates) ? body.creates : [];
      const updates = Array.isArray(body.updates) ? body.updates : [];
      const next = projects.slice();
      const byId = new Map(next.map((p, i) => [p.id, i]));
      let created = 0, updated = 0, skipped = 0;
      for (const proj of creates) {
        if (!proj.id || !proj.title || !proj.workstream || byId.has(proj.id)) { skipped++; continue; }
        byId.set(proj.id, next.length);
        next.push({ impact: 3, effort: "M", ...proj });
        created++;
      }
      for (const patch of updates) {
        const { id, ...rest } = patch || {};
        const idx = id != null ? byId.get(id) : undefined;
        if (idx == null) { skipped++; continue; }
        next[idx] = { ...next[idx], ...rest };
        updated++;
      }
      await saveState({ ...state, projects: next });
      return res.status(200).json({ ok: true, projects: next, created, updated, skipped });
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const next = projects.filter((p) => p.id !== id);
      if (next.length === projects.length) {
        return res.status(404).json({ error: `Project "${id}" not found` });
      }
      await saveState({ ...state, projects: next });
      return res.status(200).json({ ok: true, projects: next });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
