# RM500 Startup — Deploy to Vercel

**🔴 Live:** https://rm500-startup.vercel.app/ · **📷 Share page:** https://rm500-startup.vercel.app/share.html

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

## Notes
- **Custom domain:** in the Vercel dashboard → your project → *Settings → Domains*, you can attach your own domain (e.g. `game.muchen.com.my`).
- **Updating the game:** replace `index.html` and re-drag the folder (Option A), or run `vercel --prod` again (Option B).
- This is a training simulation, not legal or financial advice. Figures are simplified for gameplay; verify real-world specifics against current SSM / Companies Act 2016 rules.
