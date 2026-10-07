/* The analytics beacon's endpoint: one page view in, one row out.
 *
 * Called by beacon.js from every site we host, so it is the one public,
 * cross-origin endpoint: any origin may POST, nothing is read back. No
 * cookie is set and nothing identifying is stored - the session id is a
 * random string the browser made for this tab and forgets when it closes.
 *
 * Only the site id, path, referrer host and device class are kept, plus
 * the country and town Vercel already worked out from the connection and
 * where the visit came from (see sourceOf). A click keeps the words on
 * the button and where it went, nothing typed. Bots by
 * user agent are dropped. A site id that is not a site is dropped too,
 * quietly: a beacon never gets an error a visitor could see.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|go-http-client|java\//i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* sendBeacon can only send a plain string, so the body arrives as text
   whatever the header says. */
function parse(body) {
  if (body && typeof body === 'object') return body;
  try { return JSON.parse(String(body || '')); } catch (e) { return null; }
}

function hostOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase() || null; } catch (e) { return null; }
}

/* Names people know for the places traffic comes from. */
const NAMES = {
  facebook: 'Facebook', fb: 'Facebook', meta: 'Facebook', 'm.facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'lm.facebook.com': 'Facebook', 'facebook.com': 'Facebook',
  instagram: 'Instagram', ig: 'Instagram', 'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
  google: 'Google', 'google.com': 'Google', 'google.co.uk': 'Google', bing: 'Bing', 'bing.com': 'Bing',
  tiktok: 'TikTok', 'tiktok.com': 'TikTok', linkedin: 'LinkedIn', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn',
  youtube: 'YouTube', 'youtube.com': 'YouTube', 'x.com': 'X', 't.co': 'X', twitter: 'X',
  'chatgpt.com': 'ChatGPT', chatgpt: 'ChatGPT', 'perplexity.ai': 'Perplexity', 'duckduckgo.com': 'DuckDuckGo',
  email: 'Email', newsletter: 'Email', resend: 'Email', whatsapp: 'WhatsApp'
};
const PAID = /^(cpc|ppc|cpm|paid|paid[_-]?social|paidsocial|social[_-]?paid|ads?|display|paid[_-]?search)$/i;

function nameOf(raw) {
  const k = String(raw || '').trim().toLowerCase().replace(/^www\./, '');
  if (!k) return null;
  if (NAMES[k]) return NAMES[k];
  if (/(^|\.)google\./.test(k)) return 'Google';
  if (/(^|\.)facebook\.com$/.test(k)) return 'Facebook';
  if (/(^|\.)instagram\.com$/.test(k)) return 'Instagram';
  return k.slice(0, 40);
}

/* Where a visit came from, from the address it landed on and the site
   that sent it. An ad is certain when its tags say paid, or it carries a
   click id only ads have (Google, Microsoft, TikTok). Facebook and
   Instagram put their click id on every link, ads and shared posts alike,
   so that is 'likely'. The click id itself is never kept. */
function sourceOf(pageUrl, refHost, ua) {
  let q;
  try { q = new URL(String(pageUrl)).searchParams; } catch (e) { q = new URLSearchParams(''); }
  const get = (k) => String(q.get(k) || '').trim().slice(0, 60);
  const utmSource = get('utm_source'), utmMedium = get('utm_medium');
  const campaign = [get('utm_campaign'), get('utm_content')].filter(Boolean).join(' · ').slice(0, 120) || null;
  if (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) return { source: 'Google', from_ad: 'yes', campaign };
  if (q.get('msclkid')) return { source: 'Bing', from_ad: 'yes', campaign };
  if (q.get('ttclid')) return { source: 'TikTok', from_ad: 'yes', campaign };
  if (utmSource) return { source: nameOf(utmSource), from_ad: PAID.test(utmMedium) ? 'yes' : null, campaign };
  if (q.get('fbclid')) {
    const insta = /Instagram/i.test(String(ua || '')) || (refHost && /instagram/.test(refHost));
    return { source: insta ? 'Instagram' : 'Facebook', from_ad: 'likely', campaign };
  }
  return { source: refHost ? nameOf(refHost) : null, from_ad: null, campaign };
}

function cityOf(headers) {
  let c = String(headers['x-vercel-ip-city'] || '');
  try { c = decodeURIComponent(c); } catch (e) { /* keep as sent */ }
  return c.trim().slice(0, 60) || null;
}

/* What is kept of a view, or null if it is not worth a row. */
function clean(input, headers) {
  if (!input || !UUID.test(String(input.site || ''))) return null;
  if (BOT.test(String(headers['user-agent'] || ''))) return null;
  const session = String(input.session || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  if (session.length < 8) return null;
  let path = String(input.path || '/').split('?')[0].split('#')[0].slice(0, 200) || '/';
  if (path[0] !== '/') path = '/' + path;
  const pageHost = hostOf(input.url);
  const refHost = hostOf(input.referrer);
  // A referrer on the same site is navigation, not a source.
  const referrer = refHost && refHost !== pageHost ? refHost : null;
  const device = Number(input.width) > 0 && Number(input.width) < 768 ? 'phone' : 'desktop';
  const country = String(headers['x-vercel-ip-country'] || '').toUpperCase().slice(0, 2) || null;
  const from = sourceOf(input.url, referrer, headers['user-agent']);
  return { site_id: String(input.site).toLowerCase(), session, path, referrer, device, country, city: cityOf(headers), source: from.source, from_ad: from.from_ad, campaign: from.campaign };
}

/* A button or link pressed, or null. The words on it and where it went. */
function cleanClick(input, headers) {
  if (!input || !UUID.test(String(input.site || ''))) return null;
  if (BOT.test(String(headers['user-agent'] || ''))) return null;
  const session = String(input.session || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  if (session.length < 8) return null;
  const label = String(input.label || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!label) return null;
  let path = String(input.path || '/').split('?')[0].split('#')[0].slice(0, 200) || '/';
  if (path[0] !== '/') path = '/' + path;
  const target = String(input.target || '').split('?')[0].split('#')[0].trim().slice(0, 200) || null;
  return { site_id: String(input.site).toLowerCase(), session, path, label, target };
}

/* A payment the site reported from its thank-you page (k1.payment), or
   null. Amount is whole pence; ref is the site's own order id, and the
   same ref twice is one payment. Without a ref, the session and amount
   stand in, so a refreshed page still counts once. */
function cleanPayment(input, headers) {
  if (!input || !UUID.test(String(input.site || ''))) return null;
  if (BOT.test(String(headers['user-agent'] || ''))) return null;
  const amount = Math.round(Number(input.amount));
  if (!(amount >= 0 && amount <= 100000000)) return null;
  const session = String(input.session || '').replace(/[^a-z0-9]/gi, '').slice(0, 32) || null;
  const ref = String(input.ref || '').trim().slice(0, 120) || (session ? 'visit:' + session + ':' + amount : null);
  if (!ref) return null;
  const email = String(input.email || '').trim().toLowerCase().slice(0, 200);
  return {
    site_id: String(input.site).toLowerCase(), source: 'site', ref, amount_pence: amount,
    currency: (String(input.currency || 'gbp').toLowerCase().match(/^[a-z]{3}$/) || ['gbp'])[0],
    customer_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    customer_name: String(input.name || '').trim().slice(0, 120) || null,
    description: String(input.description || '').trim().slice(0, 300) || null,
    session
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).end(); }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('beacon: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(204).end();
  }

  try {
    const input = parse(req.body);
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if (input && input.type === 'payment') {
      const pay = cleanPayment(input, req.headers || {});
      if (!pay) return res.status(204).end();
      // Stored for Analytics only. The beacon is public (the site id is in
      // every page's source), so nothing it receives may reach a phone;
      // the push for money in comes from the dashboard's own event call,
      // which carries the site's secret. See api/event.js.
      const { error: payErr } = await db.from('payments').upsert(pay, { onConflict: 'site_id,ref', ignoreDuplicates: true });
      if (payErr && !/foreign key|violates/i.test(payErr.message)) console.error('beacon payment:', payErr.message);
      return res.status(204).end();
    }
    if (input && input.type === 'click') {
      const c = cleanClick(input, req.headers || {});
      if (!c) return res.status(204).end();
      const { error: clickErr } = await db.from('page_clicks').insert(c);
      if (clickErr && !/foreign key|violates/i.test(clickErr.message)) console.error('beacon click:', clickErr.message);
      return res.status(204).end();
    }
    const row = clean(input, req.headers || {});
    if (!row) return res.status(204).end();
    // An unknown site id is not a site: the insert fails the foreign key
    // and that is the whole check. Nothing to say back either way.
    const { error } = await db.from('page_views').insert(row);
    if (error && !/foreign key|violates/i.test(error.message)) console.error('beacon:', error.message);
  } catch (err) {
    console.error('beacon:', err && err.message);
  }
  return res.status(204).end();
};

module.exports.clean = clean;
module.exports.cleanPayment = cleanPayment;
module.exports.cleanClick = cleanClick;
module.exports.sourceOf = sourceOf;
