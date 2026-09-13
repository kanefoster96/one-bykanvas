/* The second half of a call the owner placed from the app.
 *
 * api/app.js (call_back) asks Twilio to ring the owner's mobile with this
 * as the instructions. When the owner answers, Twilio fetches this, and
 * we say: now dial the customer, showing the site's number. The customer
 * sees the business calling, not a personal mobile. Signed by Twilio like
 * every other webhook; the numbers came from our own URL.
 */
const { createClient } = require('@supabase/supabase-js');
const { configured, params, validSignature, twiml, xmlEscape } = require('../_twilio.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !configured()) return res.status(500).end();
  const fields = params(req);
  if (!validSignature(req, fields)) return res.status(403).end();
  const q = new URL('https://x' + String(req.url || '')).searchParams;
  const to = String(q.get('to') || ''), siteId = String(q.get('site') || '');
  if (!/^\+\d{8,15}$/.test(to)) return twiml(res, '<Say>Sorry, that number does not look right.</Say><Hangup/>');
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: site } = await db.from('sites').select('id, phone_number').eq('id', siteId).maybeSingle();
  if (!site || !site.phone_number) return twiml(res, '<Say>Sorry, this site has no number.</Say><Hangup/>');
  return twiml(res, '<Say>Connecting you now.</Say><Dial callerId="' + xmlEscape(site.phone_number) + '"><Number>' + xmlEscape(to) + '</Number></Dial>');
};
