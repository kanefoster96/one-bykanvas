/* A text or a WhatsApp message to a site's number.
 *
 * Twilio sends both here (WhatsApp senders can share the URL). The channel
 * comes from the "whatsapp:" prefix on the numbers. Either way the message
 * becomes a thread in the owner's Chat tab, keyed by the sender's number,
 * and the owner's phone gets a notification that opens it. If the owner
 * has no app installed yet, the text is forwarded to their mobile instead.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('../_env.js');
const { configured, params, validSignature, twiml, sendSms } = require('../_twilio.js');
const { event } = require('../_notify.js');
const { devicesFor } = require('../_push.js');
const { threadFor, addMessage, cleanBody, preview } = require('../_chat.js');

function split(addr) {
  const s = String(addr || '');
  return s.startsWith('whatsapp:') ? { channel: 'whatsapp', number: s.slice(9) } : { channel: 'sms', number: s };
}

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
    const to = split(fields.To), from = split(fields.From);
    const body = cleanBody(fields.Body);
    const { data: site } = await db.from('sites').select('id, owner_id, phone_number, forward_to').eq('phone_number', to.number).maybeSingle();
    if (!site || !body || !from.number) return twiml(res, '');
    await db.from('call_log').insert({ site_id: site.id, kind: 'sms_in', from_number: from.number, body });
    const conv = await threadFor(db, site, to.channel, from.number, { visitor_name: fields.ProfileName ? String(fields.ProfileName).slice(0, 80) : null });
    if (conv.blocked_at) return twiml(res, '');
    const made = await addMessage(db, conv, 'visitor', body);
    await event(db, site.id, 'chat', { name: (conv.visitor_name || from.number) + (to.channel === 'whatsapp' ? ' on WhatsApp' : ''), preview: preview(body), record: 'chat', id: conv.id });
    await db.from('conversations').update({ pushed_at: new Date().toISOString() }).eq('id', conv.id);
    // No app on any phone yet: fall back to forwarding the text itself.
    const devices = await devicesFor(db, site.owner_id);
    if (!devices.length && site.forward_to && to.channel === 'sms') await sendSms({ from: site.phone_number, to: site.forward_to, body: from.number + ': ' + body });
    void made;
    return twiml(res, '');
  } catch (err) {
    console.error('twilio sms:', err && err.message);
    return twiml(res, '');
  }
};
