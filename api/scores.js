// Shared leaderboard API for RM500 Startup — backed by Supabase (Postgres via PostgREST).
// No npm deps: talks to Supabase's REST API with fetch, using env vars that the
// Vercel–Supabase integration injects automatically.
// One-time setup: create the table with the SQL in README.md.
// Secure-by-default: resetting the board requires an ADMIN_KEY you set yourself.

const SB_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;

// Service-role key is server-side only (never sent to the browser); it bypasses RLS.
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TABLE = process.env.SCORES_TABLE || 'scores';
const TOP_N = 50;
const SELECT = 'name,idea,idea_em,structure,struct_em,score,ts';

function rest(path, init) {
  return fetch(SB_URL.replace(/\/+$/, '') + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

function clean(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

// Map a DB row (snake_case) to the shape the game expects (camelCase).
function toEntry(row) {
  return {
    name: row.name,
    idea: row.idea,
    ideaEm: row.idea_em,
    structure: row.structure,
    structEm: row.struct_em,
    score: Number(row.score),
    ts: Number(row.ts),
  };
}

async function topBoard() {
  const r = await rest(
    TABLE + '?select=' + SELECT + '&order=score.desc&limit=' + TOP_N
  );
  if (!r.ok) throw new Error('supabase select ' + r.status + ' ' + (await r.text()));
  const rows = await r.json();
  return rows.map(toEntry);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!SB_URL || !SB_KEY) {
    res.status(503).json({ error: 'store_not_configured' });
    return;
  }

  try {
    // ---- Host-only reset: DELETE /api/scores?key=YOUR_ADMIN_KEY ----
    if (req.method === 'DELETE') {
      const admin = process.env.ADMIN_KEY;
      const given = (req.query && req.query.key) || '';
      if (!admin || given !== admin) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      // PostgREST requires a filter to delete; score>=min-int matches every row.
      const r = await rest(TABLE + '?score=gte.-2147483648', { method: 'DELETE' });
      if (!r.ok) throw new Error('supabase delete ' + r.status + ' ' + (await r.text()));
      res.status(200).json({ board: [] });
      return;
    }

    // ---- Submit a score ----
    if (req.method === 'POST') {
      const b =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const scoreNum = Math.round(Number(b.score));
      if (!isFinite(scoreNum)) {
        res.status(400).json({ error: 'bad_score' });
        return;
      }
      const row = {
        name: clean(b.name, 22) || 'Anon',
        idea: clean(b.idea, 40),
        idea_em: clean(b.ideaEm, 8),
        structure: clean(b.structure, 40),
        struct_em: clean(b.structEm, 8),
        score: scoreNum,
        ts: Number(b.ts) || Date.now(),
      };
      const r = await rest(TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error('supabase insert ' + r.status + ' ' + (await r.text()));
    }

    // ---- Return the top scores (for GET and after a POST) ----
    res.status(200).json({ board: await topBoard() });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
