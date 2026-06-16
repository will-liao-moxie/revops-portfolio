import { getSettings, saveSettings, requireEditKey, parseBody } from "./_lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json(await getSettings());
    }
    if (!requireEditKey(req, res)) return;
    if (req.method === "PUT" || req.method === "POST") {
      await saveSettings(parseBody(req) || {});
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
