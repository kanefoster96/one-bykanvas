/* Rate limits for the forms and endpoints anyone can use without logging in.
 *
 * Counted in the database (public.hit_rate, migration 0054), one fixed
 * window per key, so it holds across every serverless instance. Keys are a
 * name plus a hash of the visitor's address: no raw IP address is stored.
 *
 * Fails open. If counting goes wrong a real person still gets through; the
 * limit is there to stop floods, not to be another way for a form to break.
 */
const crypto = require('crypto');

function clientIp(req) {
  const fwd = String((req && req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '');
  return fwd.split(',')[0].trim();
}

function ipKey(req) {
  const ip = clientIp(req);
  return ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 20) : '';
}

/* true when this request is over the limit. */
async function overLimit(db, key, max, windowSeconds) {
  try {
    const { data, error } = await db.rpc('hit_rate', { p_key: String(key).slice(0, 200), p_window_seconds: windowSeconds, p_max: max });
    if (error) { console.error('rate: count failed:', error.message); return false; }
    return data === true;
  } catch (e) {
    console.error('rate: count failed:', e && e.message);
    return false;
  }
}

/* The usual case: so many requests from one address in a window. */
async function limitIp(db, req, name, max, windowSeconds) {
  const k = ipKey(req);
  if (!k) return false;
  const over = await overLimit(db, name + ':' + k, max, windowSeconds);
  if (over) console.log('rate: %s over %d per %ds', name, max, windowSeconds);
  return over;
}

/* The answer to send when over: plain, and the same for every endpoint. */
function tooMany(res) {
  res.setHeader('Retry-After', '600');
  return res.status(429).json({ error: 'Too many tries just now. Please wait a few minutes and try again.' });
}

module.exports = { limitIp, overLimit, tooMany, clientIp };
