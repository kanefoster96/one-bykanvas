/* A site's own dashboard tells the owner's phone something happened.
 *
 *   POST /api/event
 *   Authorization: Bearer <the site's event secret, from the admin page>
 *   { "site": "<site id>", "kind": "booking", "data": { "name": "Sam", "what": "Boiler service", "when": "Tue 10am", "record": "booking", "id": "bk_12" } }
 *
 * The kind picks the wording (see _notify.js TEMPLATES) and the site's
 * labels finish it, so a plumber reads "New job" and a cafe "New order".
 * record + id become the deep link, from the site's deep_links map; with
 * no map the notification opens the dashboard's front door, which is
 * enough. The data is kept to known keys, short strings and numbers.
 *
 * The secret is compared in constant time. Anything wrong gets 401 with
 * no detail; a site that never sends is a site that never notifies.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { event } = require('./_notify.js');

const KINDS = ['money_in', 'money_failed', 'money_refund', 'money_cancelled', 'work', 'booking', 'person', 'review'];
const KEYS = ['amount', 'currency', 'name', 'what', 'when', 'where', 'detail', 'title', 'method', 'reason', 'email', 'phone', 'source', 'stars', 'text', 'record', 'id'];

function cleanData(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const k of KEYS) {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, k === 'text' || k === 'detail' ? 500 : 200);
  }
  if (out.record && !/^[a-z_]{1,30}$/.test(out.record)) delete out.record;
  if (out.id != null) out.id = String(out.id).slice(0, 80);
  return out;
}

function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ error: 'Method not allowed' }); }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('event: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const auth = String(req.headers.authorization || '');
    const secret = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const siteId = String(body.site || '').trim();
    const kind = String(body.kind || '').trim();
    if (!secret || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)) return res.status(401).json({ error: 'Not allowed.' });
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown kind. One of: ' + KINDS.join(', ') + '.' });

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: site, error } = await db.from('sites').select('id, event_secret').eq('id', siteId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!site || !same(site.event_secret, secret)) return res.status(401).json({ error: 'Not allowed.' });

    const w = await event(db, site.id, kind, cleanData(body.data));
    return res.status(200).json({ ok: true, title: w ? w.title : null, body: w ? w.body : null });
  } catch (err) {
    console.error('event:', err && err.message);
    return res.status(500).json({ error: 'Could not send that.' });
  }
};

module.exports.cleanData = cleanData;
module.exports.KINDS = KINDS;
