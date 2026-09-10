/* The visitor's side of live chat: the widget on a customer's site talks
 * to this and nothing else.
 *
 * Public and cross-origin like the beacon. A visitor holds a random
 * token for their conversation (only its hash is stored) and every call
 * proves it; without it there is no way to read or write anything. The
 * token is the whole identity - no account, no cookie, nothing kept in
 * the browser beyond that token in localStorage.
 *
 *   start   { site, body, name?, email?, phone?, page? } -> { conversation_id, token }
 *   send    { conversation_id, token, body }             -> { message }
 *   poll    { conversation_id, token, after? }           -> { messages, status, blocked, name }
 *   details { conversation_id, token, name?, email?, phone? }
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { sha, cleanBody, cleanName, cleanEmail, cleanPhone, addMessage, overLimit, tellOwner } = require('./_chat.js');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_BODY = 2;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function parse(body) {
  if (body && typeof body === 'object') return body;
  try { return JSON.parse(String(body || '')); } catch (e) { return null; }
}

/* The conversation behind a token, or null. Constant-time on the hash. */
async function claim(db, id, token) {
  if (!UUID.test(String(id || '')) || !token) return null;
  const { data } = await db.from('conversations').select('*').eq('id', String(id).toLowerCase()).maybeSingle();
  if (!data) return null;
  const a = Buffer.from(sha(token)), b = Buffer.from(data.visitor_token_hash || '');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return data;
}

function out(m) { return { id: m.id, author: m.author, body: m.body, at: m.created_at }; }

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ error: 'Method not allowed' }); }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('chat: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Chat is not available right now.' });
  }

  try {
    const body = parse(req.body);
    if (!body) return res.status(400).json({ error: 'Bad request.' });
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const action = String(body.action || '');

    if (action === 'start') {
      const siteId = String(body.site || '').toLowerCase();
      if (!UUID.test(siteId)) return res.status(400).json({ error: 'Chat is not set up on this site.' });
      const { data: site } = await db.from('sites').select('id, modules, status').eq('id', siteId).maybeSingle();
      if (!site || !(site.modules || []).includes('chat')) return res.status(404).json({ error: 'Chat is not set up on this site.' });
      const text = cleanBody(body.body);
      if (text.length < MIN_BODY) return res.status(400).json({ error: 'Write a message first.' });
      const token = crypto.randomBytes(24).toString('base64url');
      const row = {
        site_id: site.id, visitor_token_hash: sha(token),
        visitor_name: cleanName(body.name), visitor_email: cleanEmail(body.email), visitor_phone: cleanPhone(body.phone),
        page: String(body.page || '').slice(0, 300) || null,
        visitor_online_at: new Date().toISOString()
      };
      const { data: conv, error } = await db.from('conversations').insert(row).select().single();
      if (error) throw new Error(error.message);
      const made = await addMessage(db, conv, 'visitor', text);
      await tellOwner(db, made.conversation, text);
      return res.status(200).json({ conversation_id: conv.id, token, message: out(made.message) });
    }

    const conv = await claim(db, body.conversation_id, body.token);
    if (!conv) return res.status(404).json({ error: 'That conversation is not here.' });

    if (action === 'poll') {
      let q = db.from('messages').select('id, author, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(200);
      if (body.after && !isNaN(new Date(body.after))) q = q.gt('created_at', new Date(body.after).toISOString());
      const { data } = await q;
      // Polling is presence: the widget is open, the visitor is here.
      await db.from('conversations').update({ visitor_online_at: new Date().toISOString() }).eq('id', conv.id);
      return res.status(200).json({ messages: (data || []).map(out), status: conv.status, blocked: !!conv.blocked_at, name: conv.visitor_name, email: conv.visitor_email, phone: conv.visitor_phone });
    }

    if (conv.blocked_at) return res.status(403).json({ error: 'This chat has been closed.' });

    if (action === 'send') {
      const text = cleanBody(body.body);
      if (text.length < MIN_BODY) return res.status(400).json({ error: 'Write a message first.' });
      if (await overLimit(db, conv)) return res.status(429).json({ error: 'Slow down a little - one message at a time.' });
      const made = await addMessage(db, conv, 'visitor', text);
      await db.from('conversations').update({ visitor_online_at: new Date().toISOString() }).eq('id', conv.id);
      await tellOwner(db, conv, text);
      return res.status(200).json({ message: out(made.message) });
    }

    if (action === 'details') {
      const patch = {};
      if (body.name != null) patch.visitor_name = cleanName(body.name);
      if (body.email != null) patch.visitor_email = cleanEmail(body.email);
      if (body.phone != null) patch.visitor_phone = cleanPhone(body.phone);
      if (Object.keys(patch).length) await db.from('conversations').update(patch).eq('id', conv.id);
      return res.status(200).json({ ok: true, name: patch.visitor_name === undefined ? conv.visitor_name : patch.visitor_name, email: patch.visitor_email === undefined ? conv.visitor_email : patch.visitor_email, phone: patch.visitor_phone === undefined ? conv.visitor_phone : patch.visitor_phone });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('chat:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
