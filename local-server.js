#!/usr/bin/env node
// Kopi Talk — LOCAL server for the "one laptop, my subscription" mode.
//
// Serves the games from this folder AND answers /api/coffee by shelling out to
// the `claude` CLI, which uses YOUR logged-in Claude subscription (no API key,
// no per-token billing beyond your plan). Runs on one machine only.
//
//   Prereqs: Node + the `claude` CLI, already logged in (run `claude` once).
//   Start:   node local-server.js
//   Open:    http://localhost:8787/coffee-talk   (project it at the seminar)
//
// Model: set KOPI_MODEL (default "haiku" — fast for a live room). Try "sonnet"
// or "opus" for richer role-play. Uses whatever your subscription grants.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { PERSONAS, personaSystem, coachSystem } = require('./api/_coffee-core.js');

const PORT = process.env.PORT || 8787;
const MODEL = process.env.KOPI_MODEL || 'haiku';
const ROOT = __dirname;
const KICKOFF = '(You sit down at the kopitiam with your coffee. Greet me and start chatting.)';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
};

// ---- render the conversation into a single prompt for `claude -p` ----------
function chatPrompt(msgs) {
  // First turn: just the kickoff stage-direction — let the persona open.
  if (msgs.length === 1 && msgs[0].role === 'user') return msgs[0].content;
  const lines = msgs.map(m => (m.role === 'assistant' ? 'YOU: ' : 'ME: ') + m.content).join('\n');
  return 'Here is our coffee-shop conversation so far. YOU are you (the café/business owner); ME is the person you are chatting with. Continue in character and reply with ONLY your next line — no labels, no narration:\n\n' + lines + '\nYOU:';
}
function debriefPrompt(msgs) {
  const lines = msgs.map(m => (m.role === 'assistant' ? 'PROSPECT: ' : 'TRAINEE: ') + m.content).join('\n');
  return 'Here is the full coffee-talk transcript to grade:\n\n' + lines + '\n\nNow give the trainee their debrief in the exact format you were told.';
}

// ---- call the claude CLI (uses the machine's subscription) ------------------
function askClaude(system, prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--system-prompt', system,
      '--model', MODEL,
      '--output-format', 'json',
      '--no-session-persistence',
      '--disallowed-tools', 'Bash Edit Write Read Glob Grep Task WebSearch WebFetch NotebookEdit',
    ];
    // run in a neutral cwd so no local CLAUDE.md leaks into the role-play
    const child = spawn('claude', args, { cwd: os.tmpdir(), env: process.env });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('claude timed out')); }, 90000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(new Error(e.code === 'ENOENT' ? 'claude CLI not found on PATH' : String(e.message))); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(err.trim() || ('claude exited ' + code))); return; }
      try {
        const j = JSON.parse(out);
        if (j.is_error) { reject(new Error(j.result || 'claude error')); return; }
        resolve(String(j.result || '').trim());
      } catch (e) { reject(new Error('could not parse claude output: ' + out.slice(0, 200))); }
    });
  });
}

// ---- HTTP ------------------------------------------------------------------
function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); }

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (!path.extname(p)) p += '.html';                    // cleanUrls, like Vercel
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { send(res, 403, 'text/plain', 'forbidden'); return; }
  fs.readFile(file, (e, data) => {
    if (e) { send(res, 404, 'text/plain', 'Not found: ' + p); return; }
    send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/coffee') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
    req.on('end', async () => {
      try {
        const b = JSON.parse(raw || '{}');
        const persona = PERSONAS[b.persona];
        if (!persona) { send(res, 400, 'application/json', JSON.stringify({ error: 'bad_persona' })); return; }
        let msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-40)
          .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content == null ? '' : m.content).slice(0, 2000) }))
          .filter(m => m.content);
        if (!msgs.length) msgs = [{ role: 'user', content: KICKOFF }];
        const debrief = b.mode === 'debrief';
        const lang = b.lang === 'zh' ? 'zh' : 'en';
        const system = debrief ? coachSystem(persona, lang) : personaSystem(persona, lang);
        const prompt = debrief ? debriefPrompt(msgs) : chatPrompt(msgs);
        const reply = await askClaude(system, prompt);
        send(res, 200, 'application/json', JSON.stringify({ reply: reply || '…' }));
      } catch (e) {
        send(res, 502, 'application/json', JSON.stringify({ error: 'ai_error', detail: String(e.message || e) }));
      }
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('\n  ☕  Kopi Talk (local · your Claude subscription)');
  console.log('  ──────────────────────────────────────────────');
  console.log('  Open:   http://localhost:' + PORT + '/coffee-talk');
  console.log('  Games:  http://localhost:' + PORT + '/   (RM500) · /nasi-lemak');
  console.log('  Model:  ' + MODEL + '   (set KOPI_MODEL=sonnet|opus to change)');
  console.log('  Stop:   Ctrl-C\n');
});
