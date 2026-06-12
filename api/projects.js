import { requireEditKey, parseBody, getProjects, saveProjects } from "./_lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json(await getProjects());
    }

    if (!requireEditKey(req, res)) return;
    const body = parseBody(req);

    if (req.method === "POST") {
      if (!body.id || !body.title || !body.workstream) {
        return res.status(400).json({ error: "id, title, and workstream are required" });
      }
      const projects = await getProjects();
      if (projects.some((p) => p.id === body.id)) {
        return res.status(409).json({ error: `A project with id "${body.id}" already exists — pick a new code` });
      }
      const project = { status: "Scoping", impact: 3, effort: 3, ...body };
      await saveProjects([...projects, project]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const projects = await getProjects();
      const idx = projects.findIndex((p) => p.id === id);
      if (idx < 0) return res.status(404).json({ error: `Project "${id}" not found` });
      projects[idx] = { ...projects[idx], ...patch };
      await saveProjects(projects);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const projects = await getProjects();
      const filtered = projects.filter((p) => p.id !== id);
      if (filtered.length === projects.length) {
        return res.status(404).json({ error: `Project "${id}" not found` });
      }
      await saveProjects(filtered);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
