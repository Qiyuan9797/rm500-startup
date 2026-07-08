// Shared leaderboard API — backed by Supabase (Postgres via PostgREST).
// No npm deps: talks to Supabase's REST API with fetch, using env vars that the
// Vercel–Supabase integration injects automatically.
//
// Game-aware: ?game=nasilemak uses the `nasi_scores` table; the default (RM500)
// uses `scores`. Each game keeps its own columns. One-time setup: create the
// tables with the SQL in README.md.
// Secure-by-default: resetting a board requires an ADMIN_KEY you set yourself.

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

const TOP_N = 50;

function clean(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

// ---- Per-game config: table, selected columns, and row<->entry mapping. ----
const GAMES = {
  // RM500 Startup (default) — unchanged from the original.
  rm500: {
    table: process.env.SCORES_TABLE || 'scores',
    select: 'name,idea,idea_em,structure,struct_em,score,ts',
    toEntry: (row) => ({
      name: row.name,
      idea: row.idea,
      ideaEm: row.idea_em,
      structure: row.structure,
      structEm: row.struct_em,
      score: Number(row.score),
      ts: Number(row.ts),
    }),
    toRow: (b, score) => ({
      name: clean(b.name, 22) || 'Anon',
      idea: clean(b.idea, 40),
      idea_em: clean(b.ideaEm, 8),
      structure: clean(b.structure, 40),
      struct_em: clean(b.structEm, 8),
      score,
      ts: Number(b.ts) || Date.now(),
    }),
  },
  // Nasi Lemak Empire — its own table & columns (vehicle, listed, market).
  nasilemak: {
    table: process.env.NASI_SCORES_TABLE || 'nasi_scores',
    select: 'name,vk,vehicle,em,listed,market,score,ts',
    toEntry: (row) => ({
      name: row.name,
      vk: row.vk,
      vehicle: row.vehicle,
      em: row.em,
      listed: !!row.listed,
      market: row.market,
      score: Number(row.score),
      ts: Number(row.ts),
    }),
    toRow: (b, score) => ({
      name: clean(b.name, 22) || 'Anon',
      vk: clean(b.vk, 20),
      vehicle: clean(b.vehicle, 40),
      em: clean(b.em, 8),
      listed: !!b.listed,
      market: clean(b.market, 40),
      score,
      ts: Number(b.ts) || Date.now(),
    }),
  },
  // Boardroom Betrayal — its own table & columns (archetype, ending tag).
  shareholder: {
    table: process.env.SHAREHOLDER_SCORES_TABLE || 'shareholder_scores',
    select: 'name,ak,arch,em,listed,tag,score,ts',
    toEntry: (row) => ({
      name: row.name,
      ak: row.ak,
      arch: row.arch,
      em: row.em,
      listed: !!row.listed,
      tag: row.tag,
      score: Number(row.score),
      ts: Number(row.ts),
    }),
    toRow: (b, score) => ({
      name: clean(b.name, 22) || 'Anon',
      ak: clean(b.ak, 20),
      arch: clean(b.arch, 40),
      em: clean(b.em, 8),
      listed: !!b.listed,
      tag: clean(b.tag, 8),
      score,
      ts: Number(b.ts) || Date.now(),
    }),
  },
};

function gameOf(req) {
  const g = (req.query && (req.query.game || req.query.g)) || '';
  return GAMES[String(g).toLowerCase()] || GAMES.rm500;
}

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

async function topBoard(cfg) {
  const r = await rest(
    cfg.table + '?select=' + cfg.select + '&order=score.desc&limit=' + TOP_N
  );
  if (!r.ok) throw new Error('supabase select ' + r.status + ' ' + (await r.text()));
  const rows = await r.json();
  return rows.map(cfg.toEntry);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!SB_URL || !SB_KEY) {
    res.status(503).json({ error: 'store_not_configured' });
    return;
  }

  const cfg = gameOf(req);

  try {
    // ---- Host-only reset: DELETE /api/scores?key=YOUR_ADMIN_KEY[&game=nasilemak] ----
    if (req.method === 'DELETE') {
      const admin = process.env.ADMIN_KEY;
      const given = (req.query && req.query.key) || '';
      if (!admin || given !== admin) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      // PostgREST requires a filter to delete; score>=min-int matches every row.
      const r = await rest(cfg.table + '?score=gte.-2147483648', { method: 'DELETE' });
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
      const row = cfg.toRow(b, scoreNum);
      const r = await rest(cfg.table, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!r.ok) throw new Error('supabase insert ' + r.status + ' ' + (await r.text()));
    }

    // ---- Return the top scores (for GET and after a POST) ----
    res.status(200).json({ board: await topBoard(cfg) });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
