/* A text to a site's number - usually a reply to the missed-call text.
 * Logged, pushed to the owner's phone as a notification, and forwarded
 * to the owner's mobile as a text with the sender's number in front, so
 * they can call or text back from their own phone. */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('../_env.js');
const { configured, params, validSignature, twiml, sendSms } = require('../_twilio.js');
const { event } = require('../_notify.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !configured()) {
    console.error('twilio sms: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']).join(', '));
    return res.status(500).end();
  }
  const fields = params(req);
  if (!validSignature(req, fields)) return res.status(403).end();

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const to = String(fields.To || '');
    const from = String(fields.From || '');
    const body = String(fields.Body || '').trim().slice(0, 1600);
    const { data: site } = await db.from('sites').select('id, owner_id, phone_number, forward_to').eq('phone_number', to).maybeSingle();
    if (!site || !body) return twiml(res, '');
    await db.from('call_log').insert({ site_id: site.id, kind: 'sms_in', from_number: from || null, body });
    await event(db, site.id, 'sms', { number: from, text: body, record: 'call' });
    if (site.forward_to) await sendSms({ from: site.phone_number, to: site.forward_to, body: from + ': ' + body });
    return twiml(res, '');
  } catch (err) {
    console.error('twilio sms:', err && err.message);
    return twiml(res, '');
  }
};
