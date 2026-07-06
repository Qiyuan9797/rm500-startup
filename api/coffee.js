// Kopi Talk — Vercel serverless backend (API-key path).
// Talks to the Claude API over raw HTTPS. Needs ANTHROPIC_API_KEY.
// For the "one laptop, my subscription" path instead, run local-server.js.
// Personas + prompts live in api/_coffee-core.js (shared with the local server).

const { API_MODEL, PERSONAS, personaSystem, coachSystem } = require('./_coffee-core.js');

const KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  if (!KEY) { res.status(503).json({ error: 'ai_not_configured' }); return; }

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const p = PERSONAS[b.persona];
    if (!p) { res.status(400).json({ error: 'bad_persona' }); return; }

    let msgs = Array.isArray(b.messages) ? b.messages : [];
    msgs = msgs.slice(-40).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content == null ? '' : m.content).slice(0, 2000),
    })).filter(m => m.content);
    if (!msgs.length || msgs[0].role !== 'user') {
      msgs.unshift({ role: 'user', content: '(You sit down at the kopitiam with your coffee. Greet me and start chatting.)' });
    }

    const debrief = b.mode === 'debrief';
    if (debrief) msgs.push({ role: 'user', content: '(The coffee is finished. Give me my debrief now.)' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: API_MODEL,
        max_tokens: debrief ? 700 : 400,
        system: debrief ? coachSystem(p) : personaSystem(p),
        messages: msgs,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: 'ai_error', detail: (j && j.error && j.error.message) || ('http ' + r.status) });
      return;
    }
    const reply = (j.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
    res.status(200).json({ reply: reply || '…' });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
