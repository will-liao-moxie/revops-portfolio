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
