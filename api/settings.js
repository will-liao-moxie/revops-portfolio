import { getState, saveState, requireEditKey, parseBody } from "./_lib/kv.js";

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method === "GET") {
      return res.status(200).json((await getState()).settings);
    }
    if (!requireEditKey(req, res)) return;
    if (req.method === "PUT" || req.method === "POST") {
      const state = await getState();
      await saveState({ ...state, settings: parseBody(req) || {} });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
