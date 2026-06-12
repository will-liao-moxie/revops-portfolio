import { put, list } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (req.method === "POST") {
      const result = await put("projects.json", JSON.stringify([{ test: true }]), {
        access: "public", contentType: "application/json",
        token, allowOverwrite: true,
      });
      return res.json({ wrote: true, url: result.url });
    }
    const { blobs } = await list({ prefix: "projects.json", token });
    return res.json({ blobCount: blobs.length, blobs: blobs.map(b => b.url) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
