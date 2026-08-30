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

function sign(userId) {
  return crypto.createHmac('sha256', secret()).update('unsub:' + userId).digest('base64url');
}

function tokenFor(userId) {
  if (!userId || !secret()) return null;
  return Buffer.from(String(userId)).toString('base64url') + '.' + sign(userId);
}

/* Returns the user id the token vouches for, or null. Compared in constant
   time so a wrong signature cannot be narrowed down one character at a time. */
function userIdFrom(token) {
  const raw = String(token || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1 || !secret()) return null;

  let userId;
  try { userId = Buffer.from(raw.slice(0, dot), 'base64url').toString('utf8'); }
  catch (e) { return null; }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const given = Buffer.from(raw.slice(dot + 1));
  const want = Buffer.from(sign(userId));
  if (given.length !== want.length) return null;
  return crypto.timingSafeEqual(given, want) ? userId : null;
}

function unsubscribeUrl(userId) {
  const token = tokenFor(userId);
  return token ? `${ourSiteUrl()}/api/unsubscribe?u=${encodeURIComponent(token)}` : null;
}

/* RFC 8058. List-Unsubscribe-Post is what makes a mail client show its own
   one-click button rather than making the reader hunt for a link, and it is
   only honoured when the URL is https - a mailto: alternative would disable
   it, so there deliberately isn't one. */
function unsubscribeHeaders(userId) {
  const url = unsubscribeUrl(userId);
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

module.exports = { tokenFor, userIdFrom, unsubscribeUrl, unsubscribeHeaders, optedOut };
