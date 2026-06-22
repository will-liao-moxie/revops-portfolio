import { getState } from "./_lib/kv.js";

/* Single combined read: { projects, settings } in one list() op (vs. one per collection). */
export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return res.status(200).json(await getState());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
