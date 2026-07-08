# RM500 Startup — Deploy to Vercel

**🔴 Live (custom domain, once DNS is set):** https://seminar.muchencosec.com/ · **📷 Share page:** https://seminar.muchencosec.com/share.html
_(fallback URL: https://rm500-startup.vercel.app/ — both point at the same deployment)_

Games are **unlisted** (`noindex` + `robots.txt`) — reachable only by link, not indexed by search engines.
QR codes (`rm500-qr.png`, `nasi-lemak-qr.png`, `shareholder-qr.png`) and share pages encode the `seminar.muchencosec.com` URLs. Every game is a **static, self-contained page** (no build step, no server, no API key) and works on any phone. All four are bilingual — an **EN / 中文** toggle in the header, plus `?lang=zh` / `?lang=en` for a language-specific link.

**The games:** `/` RM500 Startup · `/nasi-lemak` Nasi Lemak Empire · `/shareholder` Boardroom Betrayal · `/coffee-talk` Kopi Talk.

A single-page browser game (no build step, no server). This folder is ready to publish as-is.

## Sharing (QR code)

- `rm500-qr.png` — scannable QR code for the live URL (print or drop into slides).
- `share.html` — a self-contained "scan to play" page (big QR + link); open it locally or share `https://rm500-startup.vercel.app/share.html`. Print-friendly.

## What's inside

- `index.html` — the game (open it locally by double-clicking to test).
- `vercel.json` — minimal static-site config.
- `README.md` — this file.

## Option A — Drag & Drop (easiest, ~30 seconds)

1. Go to **https://vercel.com/new** and sign in (a free account is fine — GitHub, GitLab, or email).
2. Look for the **"deploy a template"** page, then find the **drag-and-drop** area (or go straight to **https://vercel.com/new/upload**).
3. Drag **this entire `vercel-deploy` folder** onto the upload area. (Drag the folder itself, not just the file — Vercel needs `index.html` at the top level.)
4. Click **Deploy**. In a few seconds you'll get a live URL like `https://rm500-startup.vercel.app`.
5. Share that URL with your seminar candidates — it works on any phone or laptop browser.

> Tip: if the upload page asks for a project name, use something short like `rm500-startup` — that becomes part of your URL.

## Option B — Vercel CLI (if you'll redeploy often)

```bash
npm i -g vercel        # one-time install
cd vercel-deploy       # this folder
vercel                 # follow the prompts; accept defaults
vercel --prod          # promote to your public production URL
```

## Shared live leaderboard (all devices)

Every finished game posts its score to a **shared** leaderboard that everyone sees, no matter which phone or laptop they played on. It's powered by a tiny serverless function (`api/scores.js`) backed by **Supabase** (free Postgres). If the store is ever unreachable, the game falls back to a this-device-only board so it never breaks.

**One-time setup (~2 min):**

1. **Create the table.** In your Supabase project → **SQL Editor** → **New query** → paste and **Run**:

   ```sql
   create table if not exists public.scores (
     id         bigint generated always as identity primary key,
     name       text not null,
     idea       text,
     idea_em    text,
     structure  text,
     struct_em  text,
     score      integer not null,
     ts         bigint,
     created_at timestamptz default now()
   );
   create index if not exists scores_score_idx on public.scores (score desc);
   ```

   (The API uses the service-role key, which bypasses row-level security — no RLS policies needed.)

2. **Env vars.** The Vercel–Supabase integration already injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the function reads them automatically. Nothing to add.
3. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy, or just `git push`). Done — scores are now shared globally.

**Resetting the board between sessions (host only, optional):**

- In Vercel → **Settings → Environment Variables**, add `ADMIN_KEY` = some secret of your choice, and redeploy.
- Then open the site as `…/?admin=YOUR_SECRET` — a **"Clear shared board"** button appears on the RM500 leaderboard. Without `ADMIN_KEY` set, no one can wipe the board (safe by default).

### Nasi Lemak Empire — its own shared board (`?game=nasilemak`)

The same `api/scores.js` function is game-aware: Nasi Lemak posts to `/api/scores?game=nasilemak`, backed by a separate **`nasi_scores`** table (RM500 keeps its own `scores` table, untouched). Run this **once** in the Supabase SQL Editor to switch it on:

```sql
create table if not exists public.nasi_scores (
  id         bigint generated always as identity primary key,
  name       text not null,
  vk         text,          -- vehicle key (enterprise / partnership / llp / sdnbhd)
  vehicle    text,          -- display name
  em         text,          -- emoji
  listed     boolean default false,
  market     text,          -- LEAP / ACE / Main, if listed
  score      integer not null,
  ts         bigint,
  created_at timestamptz default now()
);
create index if not exists nasi_scores_score_idx on public.nasi_scores (score desc);
```

Until the table exists, the game silently falls back to a this-device board (it never breaks). Host reset for this board: `DELETE /api/scores?game=nasilemak&key=YOUR_ADMIN_KEY`.

### Boardroom Betrayal — its own shared board (`?game=shareholder`)

Same idea: Boardroom Betrayal posts to `/api/scores?game=shareholder`, backed by a separate **`shareholder_scores`** table. Run this **once** in the Supabase SQL Editor:

```sql
create table if not exists public.shareholder_scores (
  id         bigint generated always as identity primary key,
  name       text not null,
  ak         text,          -- archetype key (visionary / money / operator / angel)
  arch       text,          -- archetype display name
  em         text,          -- emoji
  listed     boolean default false,
  tag        text,          -- ending emoji (👑 / ⚖️ / 💀 / …)
  score      integer not null,
  ts         bigint,
  created_at timestamptz default now()
);
create index if not exists shareholder_scores_score_idx on public.shareholder_scores (score desc);
```

Until the table exists, it falls back to a this-device board. Host reset: `DELETE /api/scores?game=shareholder&key=YOUR_ADMIN_KEY`.

## Kopi Talk — seminar recap (`/coffee-talk`)

A **choose-your-reply** game that lets participants practise the **Signal → Service → Question** method from *"Spotting Prospects Through Corporate Knowledge."* You sit for coffee with a Malaysian business owner (café / startup / family business / app founder) who drops prospect *signals* in casual chat. Each turn you pick one of three replies — ask a sharp diagnostic question (spot it), nod along (notice it), or launch into a hard sell (the cardinal sin the seminar warns against). At the end you get a built-in scorecard: signals caught vs missed, the Muchen service each maps to, a technique verdict, a /100 score, and a local leaderboard.

- **No AI, no API key, no server.** It's a static page like the other three — just deploy and it works on every phone.
- **Random prospect + shuffled signals** mean every coffee is different. Pick a specific owner, or hit 🎲 Random table.
- Bilingual EN / 中文 (`?lang=zh`). Personas and signals are drawn from the seminar deck (Aunty May, Danish, Uncle Tan, Mei).

> Earlier this game was AI-powered (Claude via an API key or the local `claude` CLI). It's now fully self-contained, so the old `api/coffee.js`, `api/_coffee-core.js` and `local-server.js` have been removed.

## Notes
- **Custom domain:** in the Vercel dashboard → your project → *Settings → Domains*, you can attach your own domain (e.g. `game.muchen.com.my`).
- **Updating the game:** replace `index.html` and re-drag the folder (Option A), or run `vercel --prod` again (Option B).
- This is a training simulation, not legal or financial advice. Figures are simplified for gameplay; verify real-world specifics against current SSM / Companies Act 2016 rules.
