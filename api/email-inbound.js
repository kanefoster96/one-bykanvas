/* A visitor replies to a chat email, and it lands back in the thread.
 *
 * Every chat email we send carries a reply address of the form
 * reply+<conversation id>@<CHAT_REPLY_DOMAIN>. Resend receives mail for that
 * domain and calls this with an `email.received` event; the conversation
 * comes from the address, the words come from the email with the quoted
 * history cut off, and the result is a visitor message in the thread and
 * a notification on the owner's phone, exactly as if they had typed it in
 * the widget.
 *
 * Setup, once: in Resend add the reply domain for receiving (an MX record),
 * add a webhook for `email.received` pointing here, and set in Vercel
 *   CHAT_REPLY_DOMAIN    e.g. reply.kanvas.one
 *   RESEND_WEBHOOK_SECRET  the webhook's signing secret (whsec_...)
 * Without the secret, deliveries are still accepted but not verified; with
 * it, anything unsigned is dropped. Only mail from the address the visitor
 * gave us is accepted, so nobody can write into a thread by guessing its id.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { cleanBody, addMessage, tellOwner } = require('./_chat.js');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body"
   with the base64 secret, offered as one or more "v1,<sig>" values. */
function verify(rawBody, headers) {
  const secret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;
  const id = headers['svix-id'], ts = headers['svix-timestamp'], sigs = String(headers['svix-signature'] || '');
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(id + '.' + ts + '.' + rawBody).digest('base64');
  return sigs.split(' ').some((s) => {
    const v = s.split(',')[1] || '';
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

function addressOf(s) { const m = /<([^>]+)>/.exec(String(s || '')); return String(m ? m[1] : s || '').trim().toLowerCase(); }

/* The reply itself, without the email they were replying to. */
function stripQuoted(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*On .{3,120} wrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+$/.test(line) && out.length) break;
    if (/^\s*Earlier:\s*$/.test(line)) break;
    if (/^\s*Reply to this email and it goes straight back/.test(line)) break;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToText(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/* The full email, when the event carries only its id. */
async function fetchEmail(id) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !id) return null;
  for (const path of ['/emails/receiving/' + encodeURIComponent(id), '/emails/' + encodeURIComponent(id)]) {
    try {
      const res = await fetch('https://api.resend.com' + path, { headers: { Authorization: 'Bearer ' + key } });
      if (res.ok) return await res.json();
    } catch (e) { /* try the next */ }
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('email-inbound: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not configured.' });
  }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (!verify(raw, req.headers || {})) return res.status(401).json({ error: 'Bad signature.' });

  let event = {};
  try { event = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'Bad body.' }); }
  if (event.type && event.type !== 'email.received') return res.status(200).json({ ok: true, ignored: event.type });
  const data = event.data || {};

  // Which conversation: the reply+<id> address it was sent to.
  const tos = [].concat(data.to || []).map(addressOf);
  let convId = null;
  tos.forEach((t) => { const m = /^reply\+([0-9a-f-]{36})@/i.exec(t); if (m && UUID.test(m[1])) convId = m[1].toLowerCase(); });
  if (!convId) return res.status(200).json({ ok: true, ignored: 'no conversation address' });

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: conv } = await db.from('conversations').select('*').eq('id', convId).maybeSingle();
    if (!conv) return res.status(200).json({ ok: true, ignored: 'no such conversation' });
    if (conv.blocked_at) return res.status(200).json({ ok: true, ignored: 'blocked' });

    // Only the person we emailed may write back into the thread.
    const from = addressOf(data.from);
    if (!conv.visitor_email || from !== String(conv.visitor_email).toLowerCase()) {
      console.error('email-inbound: sender does not match the conversation:', from);
      return res.status(200).json({ ok: true, ignored: 'sender' });
    }

    let text = data.text || '';
    let html = data.html || '';
    if (!text && !html) { const full = await fetchEmail(data.email_id || data.id); if (full) { text = full.text || ''; html = full.html || ''; } }
    const body = cleanBody(stripQuoted(text || htmlToText(html)));
    if (body.length < 1) return res.status(200).json({ ok: true, ignored: 'empty' });

    const made = await addMessage(db, conv, 'visitor', body);
    await tellOwner(db, made.conversation, body);
    return res.status(200).json({ ok: true, message_id: made.message.id });
  } catch (err) {
    console.error('email-inbound:', err && err.message);
    // A 200 either way: Resend retrying will not make a broken message better.
    return res.status(200).json({ ok: false });
  }
};

module.exports.stripQuoted = stripQuoted;
module.exports.verify = verify;
