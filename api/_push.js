/* Push to phones.
 *
 * Two roads, chosen per device by the shape of its token:
 *
 * - Expo push tokens (`ExponentPushToken[...]`), from the Expo app in
 *   mobile/. Sent to Expo's push service, which carries them on to APNs
 *   and FCM with the keys held in the EAS project. Nothing to configure
 *   here; EXPO_ACCESS_TOKEN is optional and only needed if "enhanced push
 *   security" is switched on for the Expo account.
 *
 * - Anything else is a raw FCM registration token from the older
 *   Capacitor bundle, sent through Firebase Cloud Messaging's HTTP v1 API:
 *   a service account in FCM_SERVICE_ACCOUNT (the JSON, raw or base64), an
 *   RS256 assertion signed with Node's own crypto, one token exchange
 *   cached for its lifetime, and a POST per device. Unset means those
 *   devices are skipped and nothing else notices.
 *
 * Everything here is best effort. The thing being announced has already
 * happened, and a phone that cannot be reached must never fail it.
 */
const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
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

function isExpoToken(token) { return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(String(token || '')); }

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

/* The Expo message for one device. Expo carries data as JSON, so the
   deep link travels as it is; the app accepts either shape. */
function expoMessageFor(token, note) {
  const data = {};
  Object.keys(note.data || {}).forEach((k) => { const v = note.data[k]; if (v != null) data[k] = v; });
  const m = {
    to: token,
    title: String(note.title || '').slice(0, 120),
    body: String(note.body || '').slice(0, 500),
    data,
    sound: 'default',
    priority: 'high',
    channelId: 'one'
  };
  if (note.badge != null) m.badge = note.badge;
  return m;
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

/* The same question of one Expo push ticket. */
function isExpoDead(ticket) {
  const code = ticket && ticket.status === 'error' && ticket.details && ticket.details.error;
  return code === 'DeviceNotRegistered';
}

async function retire(db, row) {
  await db.from('device_tokens').update({ failed_at: new Date().toISOString() }).eq('id', row.id);
}

async function sendExpo(db, rows, note, f, out) {
  const headers = { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' };
  const access = String(process.env.EXPO_ACCESS_TOKEN || '').trim();
  if (access) headers.Authorization = 'Bearer ' + access;
  for (let i = 0; i < rows.length; i += EXPO_BATCH) {
    const batch = rows.slice(i, i + EXPO_BATCH);
    try {
      const res = await f(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(batch.map((r) => expoMessageFor(r.token, note))) });
      const body = await res.json().catch(() => ({}));
      const tickets = Array.isArray(body.data) ? body.data : [];
      if (!res.ok || !tickets.length) {
        console.error('push: expo refused:', res.status, (body.errors && body.errors[0] && body.errors[0].message) || '');
        out.skipped += batch.length;
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        const t = tickets[j];
        if (t && t.status === 'ok') { out.sent++; continue; }
        if (isExpoDead(t)) { out.dead++; await retire(db, batch[j]); }
        else console.error('push: expo ticket:', (t && t.message) || 'no ticket', (t && t.details && t.details.error) || '');
      }
    } catch (err) { console.error('push:', err.message); out.skipped += batch.length; }
  }
}

async function sendFcm(db, rows, note, f, out) {
  const sa = account();
  if (!sa) { out.skipped += rows.length; return; }
  let bearer;
  try { bearer = await accessToken(sa, f); }
  catch (err) { console.error('push:', err.message); out.skipped += rows.length; return; }

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
      if (isDead(body)) { out.dead++; await retire(db, row); }
      else console.error('push: device refused:', res.status, (body.error && body.error.message) || '');
    } catch (err) { console.error('push:', err.message); }
  }
}

/* Sends one note to every live device in `rows` (device_tokens rows).
   Returns { sent, dead, skipped } and never throws. */
async function pushTo(db, rows, note, fetchFn) {
  const out = { sent: 0, dead: 0, skipped: 0 };
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!f || !rows || !rows.length) { out.skipped = (rows || []).length; return out; }
  const expo = rows.filter((r) => isExpoToken(r.token));
  const fcm = rows.filter((r) => !isExpoToken(r.token));
  if (expo.length) await sendExpo(db, expo, note, f, out);
  if (fcm.length) await sendFcm(db, fcm, note, f, out);
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

module.exports = { pushTo, devicesFor, messageFor, expoMessageFor, isDead, isExpoDead, isExpoToken, account, _resetCache() { cached = null; } };
