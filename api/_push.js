/* Push to phones, through Firebase Cloud Messaging's HTTP v1 API.
 *
 * One send path for both platforms: Android goes through FCM natively, and
 * iOS goes through it too once the APNs key is uploaded to the Firebase
 * project. No SDK - a service account, an RS256 assertion signed with
 * Node's own crypto, one token exchange cached for its lifetime, and a
 * POST per device.
 *
 * Configured by FCM_SERVICE_ACCOUNT in Vercel: the Firebase service
 * account JSON, either raw or base64. Unset means "no push" and every
 * call quietly does nothing, so the rest of the app works without it.
 *
 * Everything here is best effort. The thing being announced has already
 * happened, and a phone that cannot be reached must never fail it.
 */
const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
let cached = null; // { token, expires } for this warm lambda

function account() {
  const raw = String(process.env.FCM_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  try {
    const json = raw[0] === '{' ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(json);
    return sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch (e) { return null; }
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/* A signed JWT the token endpoint swaps for a bearer token, good for an
   hour. Cached with a minute to spare. */
async function accessToken(sa, fetchFn) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expires > now + 60) return cached.token;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(header + '.' + claims), sa.private_key);
  const assertion = header + '.' + claims + '.' + b64url(sig);
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(assertion)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('token exchange failed: ' + (data.error_description || data.error || res.status));
  cached = { token: data.access_token, expires: now + (Number(data.expires_in) || 3600) };
  return cached.token;
}

/* The FCM message for one device. Data values must be strings, so the
   deep link travels as JSON text and the app parses it on tap. */
function messageFor(token, note) {
  const data = {};
  Object.keys(note.data || {}).forEach((k) => { const v = note.data[k]; if (v != null) data[k] = typeof v === 'string' ? v : JSON.stringify(v); });
  return {
    message: {
      token,
      notification: { title: String(note.title || '').slice(0, 120), body: String(note.body || '').slice(0, 500) },
      data,
      android: { priority: 'high', notification: { channel_id: 'one', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: note.badge == null ? undefined : note.badge, 'thread-id': note.thread || undefined } } }
    }
  };
}

/* Tokens FCM says are gone (uninstalled, expired) are marked so the next
   send skips them. Anything else is logged and left: a transient error
   should not retire a good phone. */
function isDead(body) {
  const err = body && body.error;
  if (!err) return false;
  if (err.status === 'NOT_FOUND' || err.status === 'UNREGISTERED') return true;
  const details = Array.isArray(err.details) ? err.details : [];
  return details.some((d) => d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT' && /registration token/i.test(err.message || ''));
}

/* Sends one note to every live device in `rows` (device_tokens rows).
   Returns { sent, dead } and never throws. */
async function pushTo(db, rows, note, fetchFn) {
  const out = { sent: 0, dead: 0, skipped: 0 };
  const sa = account();
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!sa || !f || !rows || !rows.length) { out.skipped = (rows || []).length; return out; }
  let bearer;
  try { bearer = await accessToken(sa, f); }
  catch (err) { console.error('push:', err.message); out.skipped = rows.length; return out; }

  const url = 'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(sa.project_id) + '/messages:send';
  for (const row of rows) {
    try {
      const res = await f(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageFor(row.token, note))
      });
      if (res.ok) { out.sent++; continue; }
      const body = await res.json().catch(() => ({}));
      if (isDead(body)) {
        out.dead++;
        await db.from('device_tokens').update({ failed_at: new Date().toISOString() }).eq('id', row.id);
      } else {
        console.error('push: device refused:', res.status, (body.error && body.error.message) || '');
      }
    } catch (err) { console.error('push:', err.message); }
  }
  return out;
}

/* Live devices for one user, or for every admin. */
async function devicesFor(db, who) {
  let q = db.from('device_tokens').select('id, token, platform').is('failed_at', null).limit(20);
  q = who === 'admin' ? q.eq('is_admin', true) : q.eq('user_id', who);
  const { data, error } = await q;
  if (error) { console.error('push: devices:', error.message); return []; }
  return data || [];
}

module.exports = { pushTo, devicesFor, messageFor, isDead, account, _resetCache() { cached = null; } };
