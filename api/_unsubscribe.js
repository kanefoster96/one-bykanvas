/* One-click unsubscribe, for the emails a customer may legitimately turn off.
 *
 * Deliberately not on every email we send. A payment failure, a plan ending or
 * a welcome to a plan just paid for are service messages about a contract, and
 * a customer who "unsubscribed" from those would either be ignored - which is
 * the thing that actually damages a sender's reputation - or left uninformed
 * about their own money. List-Unsubscribe goes only on mail we will genuinely
 * stop sending, and stopping it genuinely works.
 *
 * The token is an HMAC over the user id rather than the id alone: the link
 * leaves our hands the moment it is sent, so without a signature anyone could
 * unsubscribe anyone by editing a URL. It never expires - an unsubscribe link
 * in a two-year-old email should still work.
 */
const crypto = require('crypto');
const { ourSiteUrl } = require('./_env.js');

function secret() {
  /* A dedicated secret if there is one, otherwise the service role key, which
     is already a high-entropy server-only value. Rotating either invalidates
     existing links, which only costs someone a second click. */
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/* Two things a customer can turn off, and they are not the same thing:
   'notify' is updates about their own site, 'marketing' is us selling to them.
   The scope rides inside the signature so a link for one cannot be edited into
   a link for the other. */
const SCOPES = { notify: 'notify_optout', marketing: 'marketing_optin' };

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update('unsub:' + payload).digest('base64url');
}

function tokenFor(userId, scope) {
  if (!userId || !secret()) return null;
  const use = SCOPES[scope] ? scope : 'notify';
  /* A bare id with no scope is a link from before there were two - it still
     means notifications, so old links keep working. */
  const payload = use === 'notify' ? String(userId) : use + '.' + String(userId);
  return Buffer.from(payload).toString('base64url') + '.' + sign(payload);
}

/* Returns the user id the token vouches for, or null. Compared in constant
   time so a wrong signature cannot be narrowed down one character at a time. */
function readToken(token) {
  const raw = String(token || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1 || !secret()) return null;

  let payload;
  try { payload = Buffer.from(raw.slice(0, dot), 'base64url').toString('utf8'); }
  catch (e) { return null; }

  const split = payload.indexOf('.');
  const scope = split > 0 ? payload.slice(0, split) : 'notify';
  const userId = split > 0 ? payload.slice(split + 1) : payload;
  if (!SCOPES[scope]) return null;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const given = Buffer.from(raw.slice(dot + 1));
  const want = Buffer.from(sign(payload));
  if (given.length !== want.length) return null;
  return crypto.timingSafeEqual(given, want) ? { userId, scope, column: SCOPES[scope] } : null;
}

function unsubscribeUrl(userId, scope) {
  const token = tokenFor(userId, scope);
  return token ? `${ourSiteUrl()}/api/unsubscribe?u=${encodeURIComponent(token)}` : null;
}

/* RFC 8058. List-Unsubscribe-Post is what makes a mail client show its own
   one-click button rather than making the reader hunt for a link, and it is
   only honoured when the URL is https - a mailto: alternative would disable
   it, so there deliberately isn't one. */
function unsubscribeHeaders(userId, scope) {
  const url = unsubscribeUrl(userId, scope);
  if (!url) return {};
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };
}

/* Has this customer turned optional email off? Never blocks on a database
   problem: failing to send a notification is worse than sending one too many,
   and this is not how anything is charged or granted. */
async function optedOut(db, userId) {
  if (!userId) return false;
  try {
    const { data, error } = await db
      .from('profiles').select('notify_optout').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data && data.notify_optout);
  } catch (err) {
    console.error('unsubscribe: could not read preference:', err && err.message);
    return false;
  }
}

module.exports = { SCOPES, tokenFor, readToken, unsubscribeUrl, unsubscribeHeaders, optedOut };
