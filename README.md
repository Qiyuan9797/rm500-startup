# RM500 Startup — Deploy to Vercel

A single-page browser game (no build step, no server). This folder is ready to publish as-is.

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

## Notes

- **Leaderboard:** scores are saved in each visitor's own browser (localStorage). It is per-device, not shared across players on different machines. For a seminar, run it on **one projected laptop** so everyone's scores stack on the same board — or have each table use one device.
- **Custom domain:** in the Vercel dashboard → your project → *Settings → Domains*, you can attach your own domain (e.g. `game.muchen.com.my`).
- **Updating the game:** replace `index.html` and re-drag the folder (Option A), or run `vercel --prod` again (Option B).
- This is a training simulation, not legal or financial advice. Figures are simplified for gameplay; verify real-world specifics against current SSM / Companies Act 2016 rules.
