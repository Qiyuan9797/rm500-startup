# RM500 Startup — Deploy to Vercel

**🔴 Live (custom domain, once DNS is set):** https://seminar.muchencosec.com/ · **📷 Share page:** https://seminar.muchencosec.com/share.html
_(fallback URL: https://rm500-startup.vercel.app/ — both point at the same deployment)_

Games are **unlisted** (`noindex` + `robots.txt`) — reachable only by link, not indexed by search engines.
QR codes (`rm500-qr.png`, `nasi-lemak-qr.png`) and share pages encode the `seminar.muchencosec.com` URLs. **Kopi Talk stays internal** (run it on a laptop via `local-server.js`) — no public QR.

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
- Then open the site as `…/?admin=YOUR_SECRET` — a **"Clear shared board"** button appears on the leaderboard. Without `ADMIN_KEY` set, no one can wipe the board (safe by default).

## Kopi Talk — AI-powered seminar recap (`/coffee-talk`)

An AI role-play that lets seminar participants practise the **Signal → Service → Question** method from *"Spotting Prospects Through Corporate Knowledge."* Claude plays a Malaysian business owner (café / startup / family business / app founder) who drops prospect *signals* in casual chat; the player listens, probes, then gets an AI-coached scorecard on how many signals they caught.

There are **two ways** to power the AI — pick one.

### Option A — One laptop, your Claude subscription (no API key)

Run it locally on the machine you'll project, using the `claude` CLI (your Pro/Max subscription). Nothing is billed per token beyond your plan.

```bash
# prereqs: Node + the `claude` CLI, already logged in (run `claude` once)
node local-server.js
# then open http://localhost:8787/coffee-talk  (project this at the seminar)
```

- The local server (`local-server.js`) serves all the games and answers `/api/coffee` by shelling out to `claude` — so it uses your subscription directly.
- **Model:** `KOPI_MODEL=haiku node local-server.js` (default). Try `sonnet` or `opus` for richer role-play.
- Only that one laptop works — phones scanning a QR to the hosted URL can't use your subscription. Great for a projected screen; use Option B if you want everyone on their own phone.

### Option B — Hosted for everyone's phone (Anthropic API key)

Wire an API key into Vercel so the deployed `/coffee-talk` works for every phone.

1. Get a key at **console.anthropic.com** → API Keys (prepaid credits + a spend cap = pay-what-you-use).
2. In **Vercel → Settings → Environment Variables**, add `ANTHROPIC_API_KEY` = your key (all environments).
3. **Redeploy.** Until then the game shows a friendly "switch on the AI" screen.

- **Model:** `API_MODEL` at the top of `api/_coffee-core.js`. Default `claude-opus-4-8`; switch to `claude-haiku-4-5` for a faster/cheaper live seminar (a full coffee-talk + debrief is a fraction of a cent on Haiku).

Personas, prompts and the coach's answer key live in `api/_coffee-core.js`, shared by both paths.

## Notes
- **Custom domain:** in the Vercel dashboard → your project → *Settings → Domains*, you can attach your own domain (e.g. `game.muchen.com.my`).
- **Updating the game:** replace `index.html` and re-drag the folder (Option A), or run `vercel --prod` again (Option B).
- This is a training simulation, not legal or financial advice. Figures are simplified for gameplay; verify real-world specifics against current SSM / Companies Act 2016 rules.
