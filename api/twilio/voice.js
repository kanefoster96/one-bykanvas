/* A call to a site's number.
 *
 * Twilio asks us what to do (stage 1): ring the owner's mobile, showing
 * the caller's number, for twenty seconds. When the ring ends Twilio asks
 * again (stage 2, ?stage=after) with how it went. Answered: logged.
 * Anything else: the caller gets a text within seconds saying who this
 * is and that they will be called back, the owner's phone gets a
 * notification, and the call is logged as missed.
 *
 * Every request is checked against Twilio's signature first: nobody else
 * can make us ring phones or send texts.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('../_env.js');
const { configured, params, validSignature, twiml, xmlEscape, sendSms } = require('../_twilio.js');
const { event } = require('../_notify.js');
const { threadFor, addMessage } = require('../_chat.js');

const RING_SECONDS = 20;
const DEFAULT_TEXT = 'Sorry we missed your call. This is {business}. We’ll call you back shortly. If it’s quicker, reply here{book}.';

function textFor(site, business) {
  const book = site.url ? ' or book at ' + site.url : '';
  return String(site.missed_call_text || DEFAULT_TEXT).replace(/\{business\}/g, business).replace(/\{url\}/g, site.url || '').replace(/\{book\}/g, book).trim();
}

/* Withheld and non-mobile callers cannot be texted; do not try. */
function textable(number) { return /^\+\d{8,15}$/.test(String(number || '')) && !/^\+44(1|2|3|8)/.test(number); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !configured()) {
    console.error('twilio voice: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']).join(', '));
    return res.status(500).end();
  }
  const fields = params(req);
  if (!validSignature(req, fields)) return res.status(403).end();

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const to = String(fields.To || fields.Called || '');
    const from = String(fields.From || fields.Caller || '');
    const { data: site } = await db.from('sites').select('id, owner_id, name, url, phone_number, forward_to, missed_call_text').eq('phone_number', to).maybeSingle();
    if (!site || !site.forward_to) {
      return twiml(res, '<Say>Sorry, this number is not set up yet. Please try again later.</Say><Hangup/>');
    }
    const stage = /[?&]stage=after/.test(String(req.url || '')) ? 'after' : 'ring';

    if (stage === 'ring') {
      const action = ourSiteUrl() + '/api/twilio/voice?stage=after';
      return twiml(res, '<Dial timeout="' + RING_SECONDS + '" callerId="' + xmlEscape(from) + '" action="' + xmlEscape(action) + '"><Number>' + xmlEscape(site.forward_to) + '</Number></Dial>');
    }

    const status = String(fields.DialCallStatus || '');
    if (status === 'completed') {
      await db.from('call_log').insert({ site_id: site.id, kind: 'call', from_number: from || null });
      return twiml(res, '<Hangup/>');
    }

    const { data: prof } = await db.from('profiles').select('business_name, active_plan').eq('id', site.owner_id).maybeSingle();
    const business = site.name || (prof && prof.business_name) || 'us';
    const onMax = prof && prof.active_plan === 'max';
    let texted = 'skipped';
    if (onMax && textable(from)) texted = await sendSms({ from: site.phone_number, to: from, body: textFor(site, business) });
    else if (!onMax) console.log('twilio voice: text-back is a Max feature; site', site.id, 'is on', prof && prof.active_plan);
    await db.from('call_log').insert({ site_id: site.id, kind: 'missed', from_number: from || null, texted_at: texted === 'sent' ? new Date().toISOString() : null });
    // The missed call lives in the caller's text thread, so calling or
    // texting them back is one tap from the notification.
    let conv = null;
    if (textable(from)) {
      try {
        conv = await threadFor(db, site, 'sms', from);
        await addMessage(db, conv, 'system', texted === 'sent' ? 'Missed call. We texted them that you\u2019ll call back.' : 'Missed call.');
      } catch (e) { console.error('twilio voice: thread:', e.message); }
    }
    await event(db, site.id, 'missed_call', { number: from, texted: texted === 'sent', record: conv ? 'chat' : 'call', id: conv ? conv.id : undefined });
    return twiml(res, texted === 'sent'
      ? '<Say>Sorry we could not get to the phone. We have sent you a text and will call you back shortly.</Say><Hangup/>'
      : '<Say>Sorry we could not get to the phone. Please try again shortly.</Say><Hangup/>');
  } catch (err) {
    console.error('twilio voice:', err && err.message);
    return twiml(res, '<Say>Sorry, something went wrong. Please try again shortly.</Say><Hangup/>');
  }
};

module.exports.textFor = textFor;
module.exports.textable = textable;
