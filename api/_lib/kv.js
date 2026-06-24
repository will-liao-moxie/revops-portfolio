import postgres from "postgres";

/* Storage is Supabase Postgres. The whole app state ({ projects, settings }) lives in ONE row
   of app_state; every save also appends to app_state_log so we keep point-in-time history for
   recovery (the Blob store taught us to never have a single overwritable copy).
   Reads are a single indexed SELECT — no per-read list/op metering, no "store blocked" wall. */
let sql;
function db() {
  if (!sql) {
    const url = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
    // pooled Supabase/Supavisor connection runs in transaction mode → disable prepared statements
    sql = postgres(url, { prepare: false, idle_timeout: 20, max: 1, ssl: "require" });
  }
  return sql;
}

let ready;
async function ensure() {
  if (ready) return;
  const s = db();
  await s`create table if not exists app_state (id int primary key, data jsonb not null, updated_at timestamptz default now())`;
  await s`create table if not exists app_state_log (id bigserial primary key, data jsonb not null, created_at timestamptz default now())`;
  ready = true;
}

// Reads the current combined state. THROWS on a DB error (a read-modify-write that silently saw
// "empty" on a transient failure would persist a wipe). Returns empty only when the row truly
// doesn't exist yet.
export async function getState() {
  await ensure();
  const rows = await db()`select data from app_state where id = 1`;
  if (rows.length) { const s = rows[0].data || {}; return { projects: s.projects || [], settings: s.settings || {} }; }
  return { projects: [], settings: {} };
}

// Read-only variant for GET endpoints: tolerate errors with an empty result (never used for writes).
export async function getStateSafe() { try { return await getState(); } catch { return { projects: [], settings: {} }; } }

export async function saveState(state) {
  await ensure();
  const data = { projects: state.projects || [], settings: state.settings || {} };
  const s = db();
  await s`insert into app_state (id, data, updated_at) values (1, ${s.json(data)}, now())
          on conflict (id) do update set data = excluded.data, updated_at = now()`;
  await s`insert into app_state_log (data) values (${s.json(data)})`; // append-only history
}

/* compatibility helpers */
export async function getProjects() { return (await getState()).projects; }
export async function saveProjects(projects) { const s = await getState(); await saveState({ ...s, projects }); }
export async function getSettings() { return (await getState()).settings; }
export async function saveSettings(settings) { const s = await getState(); await saveState({ ...s, settings }); }

export function requireEditKey(req, res) {
  const key = process.env.EDIT_KEY;
  if (!key) return true;
  if (req.headers["x-edit-key"] === key) return true;
  res.status(401).json({ error: "Edit key required" });
  return false;
}

export function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}
