/* Twilio, the parts we use: proving a webhook came from Twilio, sending a
 * text, and answering a call with TwiML. No SDK - it is three HTTP shapes.
 *
 * TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in Vercel. Unset means every
 * webhook is refused and every text is skipped; nothing else breaks.
 */
const crypto = require('crypto');
const { ourSiteUrl } = require('./_env.js');

function configured() { return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN); }

/* Twilio posts form-encoded; Vercel may or may not have parsed it. */
function params(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  const out = {};
  new URLSearchParams(String(b || '')).forEach((v, k) => { out[k] = v; });
  return out;
}

/* Twilio's signature: HMAC-SHA1 over the full URL plus every POST field,
   sorted by name, key then value, base64. Compared in constant time. */
function expectedSignature(url, fields, token) {
  const data = url + Object.keys(fields).sort().map((k) => k + fields[k]).join('');
  return crypto.createHmac('sha1', token).update(data, 'utf8').digest('base64');
}

function validSignature(req, fields) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const given = String(req.headers['x-twilio-signature'] || '');
  if (!given) return false;
  const url = ourSiteUrl() + String(req.url || '');
  const want = expectedSignature(url, fields, token);
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function xmlEscape(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function twiml(res, inner) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response>' + inner + '</Response>');
}

/* One text. Returns 'sent', 'skipped' or 'failed'; never throws. */
async function sendSms({ from, to, body }, fetchFn) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!sid || !token || !f || !from || !to || !body) return 'skipped';
  try {
    const res = await f('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: to, Body: String(body).slice(0, 1200) }).toString()
    });
    if (res.ok) return 'sent';
    const err = await res.json().catch(() => ({}));
    console.error('twilio: text refused:', res.status, err.message || '');
    return 'failed';
  } catch (err) { console.error('twilio:', err.message); return 'failed'; }
}

/* Rings `to` and, when answered, runs the TwiML at `url`. */
async function placeCall({ from, to, url }, fetchFn) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!sid || !token || !f || !from || !to || !url) return { ok: false, error: 'Calling is not configured.' };
  try {
    const res = await f('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Calls.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: to, Url: url, Timeout: '25' }).toString()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.message || ('Twilio said no (' + res.status + ').') };
    return { ok: true, sid: data.sid };
  } catch (err) { return { ok: false, error: err.message }; }
}

/* E.164 or nothing. "07700 900123" becomes +447700900123. */
function e164(s, defaultCountry) {
  let d = String(s || '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d[0] === '+') return /^\+\d{8,15}$/.test(d) ? d : null;
  if (d.startsWith('00')) d = '+' + d.slice(2);
  else if (d[0] === '0') d = (defaultCountry || '+44') + d.slice(1);
  else d = '+' + d;
  return /^\+\d{8,15}$/.test(d) ? d : null;
}

module.exports = { configured, params, validSignature, expectedSignature, twiml, xmlEscape, sendSms, placeCall, e164 };
