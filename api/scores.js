// Shared leaderboard API for RM500 Startup.
// Backed by an Upstash Redis (a.k.a. Vercel KV) store via its REST API — no npm deps.
// Env vars are injected automatically when you connect the store to the project in Vercel.
// Secure-by-default: resetting the board requires an ADMIN_KEY you set yourself.

const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN;

const KEY = 'rm500:board';
const MAX_KEEP = 200; // cap how many entries the store retains
const TOP_N = 50; // how many we return to the page

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REDIS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error('redis http ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function clean(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!REDIS_URL || !REDIS_TOKEN) {
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
      await redis(['DEL', KEY]);
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
      const entry = {
        name: clean(b.name, 22) || 'Anon',
        idea: clean(b.idea, 40),
        ideaEm: clean(b.ideaEm, 8),
        structure: clean(b.structure, 40),
        structEm: clean(b.structEm, 8),
        score: scoreNum,
        ts: Number(b.ts) || Date.now(),
      };
      await redis(['ZADD', KEY, scoreNum, JSON.stringify(entry)]);
      // Keep only the top MAX_KEEP (drop the lowest-scoring beyond that).
      await redis(['ZREMRANGEBYRANK', KEY, 0, -(MAX_KEEP + 1)]);
    }

    // ---- Return the top scores (for GET and after a POST) ----
    const flat = await redis(['ZRANGE', KEY, 0, TOP_N - 1, 'REV', 'WITHSCORES']);
    const board = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try {
        const e = JSON.parse(flat[i]);
        e.score = Number(flat[i + 1]);
        board.push(e);
      } catch (_) {
        /* skip malformed */
      }
    }
    res.status(200).json({ board });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
