import {
  getSheets, TAB, HEADERS, rowToProject, projectToRow, requireEditKey, colLetter, parseBody,
} from "./_lib/sheets.js";

export default async function handler(req, res) {
  try {
    const { sheets, sheetId } = getSheets();

    /* ---------- READ ---------- */
    if (req.method === "GET") {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${TAB}!A1:Z`,
      });
      const rows = r.data.values || [];
      if (rows.length < 2) return res.status(200).json([]);
      const [header, ...data] = rows;
      const projects = data.filter((row) => row[0]).map((row) => rowToProject(header, row));
      return res.status(200).json(projects);
    }

    /* ---------- WRITES (gated by EDIT_KEY if set) ---------- */
    if (!requireEditKey(req, res)) return;
    const body = parseBody(req);

    if (req.method === "POST") {
      if (!body.id || !body.title || !body.workstream) {
        return res.status(400).json({ error: "id, title, and workstream are required" });
      }
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A:A` });
      const ids = (r.data.values || []).flat();
      if (ids.includes(body.id)) {
        return res.status(409).json({ error: `A project with id "${body.id}" already exists in the sheet — pick a new code` });
      }
      const project = { status: "Scoping", impact: 3, effort: 3, ...body };
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TAB}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [projectToRow(project)] },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A1:Z` });
      const rows = r.data.values || [];
      const header = rows[0] || HEADERS;
      const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id); // array index == sheet row - 1
      if (rowIndex < 1) return res.status(404).json({ error: `Project "${id}" not found in the sheet` });

      const updates = [];
      for (const [field, value] of Object.entries(patch)) {
        const col = header.indexOf(field);
        if (col < 0) continue;
        const cellValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        updates.push({ range: `${TAB}!${colLetter(col)}${rowIndex + 1}`, values: [[cellValue]] });
      }
      if (!updates.length) return res.status(400).json({ error: "No recognized fields to update" });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) return res.status(400).json({ error: "id is required" });
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tab = (meta.data.sheets || []).find((s) => s.properties.title === TAB);
      if (!tab) return res.status(404).json({ error: `Tab "${TAB}" not found` });

      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A:A` });
      const ids = (r.data.values || []).flat();
      const rowIdx = ids.indexOf(id); // 0-based, includes header at 0
      if (rowIdx < 1) return res.status(404).json({ error: `Project "${id}" not found in the sheet` });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId: tab.properties.sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 },
            },
          }],
        },
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
