/* Meta's Conversions API: the two events that matter, sent from the server
 * so that a visitor who declined cookies still counts.
 *
 *   Lead      - a free example asked for   (api/lead.js), or a business
 *               name and email given on /join (api/join.js, action lead)
 *   Purchase  - a plan gone live           (api/stripe-webhook.js)
 *
 * Off unless META_CAPI_TOKEN is set; then it needs the pixel id, which is
 * the one consent.js loads in the browser (META_PIXEL_ID overrides). The
 * browser fires the same Lead with the same event id, and Meta keeps one.
 * Every call is best effort and never throws: the lead is saved and the
 * payment is taken whether or not Meta is listening.
 */
const crypto = require('crypto');

const PIXEL_DEFAULT = '1854004872420446';
const TIMEOUT_MS = 4000;

function sha256(s) {
  return crypto.createHash('sha256').update(String(s || '').trim().toLowerCase()).digest('hex');
}

/* A UK number as Meta wants it: digits only, country code first. */
function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : '';
}

const FBC = /^fb\.1\.\d{10,14}\.[A-Za-z0-9_-]{10,500}$/;
const FBP = /^fb\.1\.\d{10,14}\.\d{5,25}$/;

/* What ties an event to the ad that was clicked, from a browser request:
   the click id and browser id the page sends (body.fbc / body.fbp, checked),
   and the address and browser the request came from. */
function adContext(req, body) {
  const b = body || {};
  const fwd = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  return {
    fbc: FBC.test(String(b.fbc || '')) ? String(b.fbc) : undefined,
    fbp: FBP.test(String(b.fbp || '')) ? String(b.fbp) : undefined,
    ip: fwd || undefined,
    userAgent: (req.headers && req.headers['user-agent']) ? String(req.headers['user-agent']).slice(0, 400) : undefined
  };
}

/* The same, kept on a Stripe subscription (metadata values are capped at
   500 characters) so the Purchase the webhook sends later can carry it. */
function adMetadata(ad) {
  const md = {};
  if (ad && ad.fbc) md.meta_fbc = ad.fbc.slice(0, 500);
  if (ad && ad.fbp) md.meta_fbp = ad.fbp.slice(0, 500);
  if (ad && ad.ip) md.meta_ip = ad.ip.slice(0, 64);
  if (ad && ad.userAgent) md.meta_ua = ad.userAgent.slice(0, 400);
  return md;
}
function adFromMetadata(md) {
  const m = md || {};
  return {
    fbc: FBC.test(String(m.meta_fbc || '')) ? m.meta_fbc : undefined,
    fbp: FBP.test(String(m.meta_fbp || '')) ? m.meta_fbp : undefined,
    ip: m.meta_ip || undefined,
    userAgent: m.meta_ua || undefined
  };
}

/* { name, eventId, email, phone, url, ip, userAgent, fbc, fbp, value, currency, custom }
   fbc is Meta's click id from the ad (fb.1.<ms>.<fbclid>), fbp its browser
   id: with them Meta can tie the event to the ad that was clicked. */
async function sendMetaEvent(ev) {
  const token = String(process.env.META_CAPI_TOKEN || '').trim();
  if (!token) return 'skipped';
  const pixel = String(process.env.META_PIXEL_ID || PIXEL_DEFAULT).trim();

  const data = {
    event_name: ev.name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: ev.eventId || undefined,
    action_source: 'website',
    event_source_url: ev.url || undefined,
    user_data: {
      em: ev.email ? [sha256(ev.email)] : undefined,
      ph: normPhone(ev.phone) ? [sha256(normPhone(ev.phone))] : undefined,
      country: [sha256('gb')],
      client_ip_address: ev.ip || undefined,
      client_user_agent: ev.userAgent || undefined,
      fbc: ev.fbc || undefined,
      fbp: ev.fbp || undefined
    },
    custom_data: Object.assign({},
      ev.value != null ? { value: Number(ev.value), currency: ev.currency || 'GBP' } : {},
      ev.custom || {})
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [data] }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('meta: %s event rejected (%s): %s', ev.name, res.status, text.slice(0, 200));
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('meta: %s event not sent: %s', ev.name, err && err.message);
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendMetaEvent, adContext, adMetadata, adFromMetadata, normPhone };
