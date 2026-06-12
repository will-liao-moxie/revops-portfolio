# Moxie RevOps — Project Portfolio

A shared portfolio app for RevOps one-pagers. The data lives in a Google Sheet (single source of truth, human-editable), served through Vercel serverless functions, with a React front end providing four views: Board, Priority Matrix, Sequence, and People & Load.

Score and status edits made in the app write back to the sheet, so everyone sees the same numbers — including live during a prioritization session.

## Architecture

```
Browser (React/Vite)
   │  GET/POST/PATCH/DELETE /api/projects
   ▼
Vercel serverless functions (api/projects.js, api/seed.js)
   │  Google Sheets API (service account)
   ▼
Google Sheet — tab "Projects", one row per project
```

Complex fields (deliverables, roles, dependsOn, contractors, teams, openItems) are stored as JSON strings in their cells. Simple fields (title, status, impact, effort…) are plain values you can edit directly in the sheet.

## Setup (one time, ~15 minutes)

### 1. Google Cloud service account
1. Go to https://console.cloud.google.com → create (or pick) a project.
2. **APIs & Services → Library** → search "Google Sheets API" → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (name it e.g. `portfolio-bot`). No roles needed.
4. Open the service account → **Keys → Add key → Create new key → JSON**. Download the file.
5. From the JSON file you need two values: `client_email` and `private_key`.

### 2. Google Sheet
1. Create a new blank Google Sheet.
2. Share it with the service account's `client_email` as **Editor**.
3. Copy the sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.
4. You don't need to create the "Projects" tab or headers — the seed endpoint does that.

### 3. Deploy to Vercel
1. Push this folder to a GitHub repo (or use `vercel` CLI directly from the folder).
2. In Vercel: **New Project → import the repo**. Framework preset: **Vite** (auto-detected). No build settings to change.
3. Add environment variables (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key — paste the whole thing, BEGIN/END lines included |
| `SHEET_ID` | from the sheet URL |
| `EDIT_KEY` | recommended — any shared passphrase; the app prompts for it once per browser on first edit |

4. Deploy.

### 4. Seed the 8 one-pagers
After the first deploy, load the initial portfolio into the sheet:

```bash
curl -X POST https://<your-app>.vercel.app/api/seed -H "x-edit-key: <your EDIT_KEY>"
```

This creates the `Projects` tab, writes the header row, and inserts the 8 projects (MS-01…04, SUP-01…03, PS-01). It refuses to run if the sheet already has data; to intentionally reset, POST with body `{"force": true}`.

## Day-to-day

- **Adjust scores / status**: open any project in the app, change the dropdowns — saves to the sheet instantly for everyone.
- **Add a project**: "+ Add project" in the app, paste JSON matching the built-in schema template. Give that schema to the AI agent that drafts the one-pagers so each new doc arrives app-ready. (Appending a row directly in the sheet also works — keep JSON columns valid JSON.)
- **Remove a project**: from the project's detail panel, or delete the row in the sheet.
- **Bulk edits**: just edit the sheet — the app reads it fresh on every load and via the ↻ Sync button.

## Access control

Two layers, use what fits:
- `EDIT_KEY` protects **writes** (anyone with the URL can view, only key-holders can edit). The browser remembers the key after first entry.
- For protecting **viewing** too, enable Vercel Deployment Protection (Standard Protection / Vercel Authentication) on the project, or keep the URL internal.

## Local development

```bash
npm install
npx vercel dev        # runs front end + API together at http://localhost:3000
```

Copy `.env.example` to `.env` and fill it in; `vercel dev` picks it up (or use `vercel env pull`). Plain `npm run dev` runs only the front end — API calls will 404 without the functions, so use `vercel dev` when working on anything data-related.

## Schema reference

Each row / JSON object:

| Field | Type | Notes |
|---|---|---|
| `id` | string | lowercase unique key, e.g. `spt-01` |
| `code` | string | display code, e.g. `SPT-01` |
| `title` | string | |
| `workstream` | string | `Marketing Services`, `Supplies`, `Practice Success`, `Support`, or new — unrecognized workstreams render with a neutral color |
| `status` | string | `Scoping`, `Proposed`, `Approved`, `In flight`, `Blocked`, `Done` |
| `impact`, `effort` | number 1–5 | drives the priority matrix |
| `stakeholder`, `revopsRole`, `devResources` | string | |
| `problem`, `solution`, `success` | string | the narrative sections |
| `teams` | JSON array of strings | used by People & Load |
| `contractors` | JSON array | `{ "name", "scope", "status": "Engaged" \| "TBD" }` |
| `deliverables` | JSON array | `{ "text", "stretch": true \| false }` |
| `roles` | JSON array | `{ "who", "what" }` |
| `dependsOn` | JSON array | `{ "id", "type": "hard" \| "soft" \| "external", "note" }` — drives Sequence view |
| `openItems` | JSON array of strings | unresolved questions/risks |
| `docUrl` | string | link to the source Google Doc one-pager |
