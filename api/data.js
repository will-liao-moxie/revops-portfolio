import { getStateSafe, saveState, getState, requireEditKey, parseBody } from "./_lib/kv.js";

/* GET  -> combined { projects, settings } in one query.
   POST -> overwrite the full state (used to restore from a browser cache). Edit-key protected;
           refuses to overwrite a non-empty store with an empty payload unless ?force=1. */
export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method === "GET") {
      return res.status(200).json(await getStateSafe());
    }
    if (req.method === "POST") {
      if (!requireEditKey(req, res)) return;
      const body = parseBody(req) || {};
      const projects = Array.isArray(body.projects) ? body.projects : [];
      const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
      const force = req.query && (req.query.force === "1" || req.query.force === "true");
      if (!projects.length && !force) {
        const cur = await getState();
        if (cur.projects.length) return res.status(409).json({ error: "Refusing to overwrite existing projects with an empty payload (use ?force=1 to override)" });
      }
      await saveState({ projects, settings });
      return res.status(200).json({ ok: true, projects, settings });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
