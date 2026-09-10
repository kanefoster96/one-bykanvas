/* The analytics beacon's endpoint: one page view in, one row out.
 *
 * Called by beacon.js from every site we host, so it is the one public,
 * cross-origin endpoint: any origin may POST, nothing is read back. No
 * cookie is set and nothing identifying is stored - the session id is a
 * random string the browser made for this tab and forgets when it closes.
 *
 * Only the site id, path, referrer host and device class are kept, plus
 * the country Vercel already worked out from the connection. Bots by
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
  return { site_id: String(input.site).toLowerCase(), session, path, referrer, device, country };
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
    const row = clean(parse(req.body), req.headers || {});
    if (!row) return res.status(204).end();
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
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
