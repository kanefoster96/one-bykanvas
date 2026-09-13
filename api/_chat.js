/* Live chat, the parts both doors share.
 *
 * The visitor's door is api/chat.js (anonymous, token in hand); the
 * owner's is api/app.js (signed in, RLS). Both land here for the shape
 * of a message, the abuse limits and the "tell the owner" rule.
 */
const crypto = require('crypto');
const { event } = require('./_notify.js');

const MAX_BODY = 2000;
const PER_MINUTE = 12;          // visitor messages in one conversation
const ONLINE_WINDOW = 90 * 1000; // a poll this recent means "still here"
const PUSH_GAP = 5 * 60 * 1000;  // one push per burst of visitor messages

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function cleanBody(s) { return String(s || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_BODY); }
function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80) || null; }
function cleanEmail(s) { const e = String(s || '').trim().toLowerCase().slice(0, 200); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null; }
function cleanPhone(s) { const p = String(s || '').replace(/[^\d+ ()-]/g, '').trim().slice(0, 30); return p.replace(/\D/g, '').length >= 7 ? p : null; }
function preview(body) { return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
function isOnline(conv, now) { return !!(conv && conv.visitor_online_at && (now || Date.now()) - new Date(conv.visitor_online_at).getTime() < ONLINE_WINDOW); }

/* The thread for a phone number on a channel (sms | whatsapp), made on
   first sight. Every text from that number is one conversation. */
async function threadFor(db, site, channel, phone, extra) {
  const { data: found } = await db.from('conversations').select('*').eq('site_id', site.id).eq('channel', channel).eq('visitor_phone', phone).maybeSingle();
  if (found) return found;
  const row = Object.assign({ site_id: site.id, channel, visitor_phone: phone, visitor_token_hash: 'x:' + channel + ':' + sha(site.id + ':' + phone), visitor_online_at: null }, extra || {});
  const { data: made, error } = await db.from('conversations').insert(row).select().single();
  if (error) {
    // Two texts at once: the other one made it first.
    const { data: again } = await db.from('conversations').select('*').eq('site_id', site.id).eq('channel', channel).eq('visitor_phone', phone).maybeSingle();
    if (again) return again;
    throw new Error(error.message);
  }
  return made;
}

/* Adds a message and moves the conversation's summary with it. A system
   note ("Missed call") does not reopen or mark anything unread. */
async function addMessage(db, conv, author, body) {
  const now = new Date().toISOString();
  const { data: msg, error } = await db.from('messages').insert({ conversation_id: conv.id, site_id: conv.site_id, author, body }).select().single();
  if (error) throw new Error(error.message);
  const patch = { last_message_at: now, last_message_by: author, last_message_preview: preview(body) };
  if (author !== 'system') patch.status = 'open';
  if (author === 'owner') patch.owner_seen_at = now;
  const { data: updated, error: upErr } = await db.from('conversations').update(patch).eq('id', conv.id).select().single();
  if (upErr) throw new Error(upErr.message);
  return { message: msg, conversation: updated };
}

/* A visitor may send only so fast. */
async function overLimit(db, conv) {
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await db.from('messages').select('id', { count: 'exact', head: true })
    .eq('conversation_id', conv.id).eq('author', 'visitor').gte('created_at', since);
  return (count || 0) >= PER_MINUTE;
}

/* The owner's phone hears about the first message of a burst, and again
   once they have replied or five minutes have passed. */
async function tellOwner(db, conv, body) {
  const last = conv.pushed_at ? new Date(conv.pushed_at).getTime() : 0;
  const fresh = conv.last_message_by === 'owner' || Date.now() - last > PUSH_GAP;
  if (!fresh) return false;
  await event(db, conv.site_id, 'chat', { name: conv.visitor_name || 'Visitor on your site', preview: preview(body), record: 'chat', id: conv.id });
  await db.from('conversations').update({ pushed_at: new Date().toISOString() }).eq('id', conv.id);
  return true;
}

module.exports = { sha, threadFor, cleanBody, cleanName, cleanEmail, cleanPhone, preview, isOnline, addMessage, overLimit, tellOwner, MAX_BODY, PER_MINUTE, ONLINE_WINDOW };
