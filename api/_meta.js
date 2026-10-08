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

/* { name, eventId, email, url, ip, userAgent, fbc, fbp, value, currency, custom }
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

module.exports = { sendMetaEvent };
