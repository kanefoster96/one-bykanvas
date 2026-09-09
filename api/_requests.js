/* One note on a request, and everything a note carries with it.
 *
 * Both sides write through here - api/requests.js for the customer,
 * api/admin.js for us - because a note is never just a row. It moves the
 * status (whose turn it is), stamps last_note_* on the request (what the
 * lists and badges read), and tells the other side in the app. Email is
 * deliberately not sent here: the note is left with emailed_at null and
 * api/request-mail.js sends it ten minutes later, folding any others from
 * the same person into the one message.
 *
 * Status rules, in one place:
 *   customer note  -> new (Open) unless it is being built, which stays.
 *   admin note     -> the status we picked, otherwise waiting (their turn).
 *   done           -> done_at stamped; a customer reply clears it again.
 *   private note   -> nothing moves, nobody is told.
 */
const { notify, notifyAdmin } = require('./_notify.js');

const STATUSES = ['new', 'waiting', 'in_progress', 'done'];
const MAX_ATTACHMENTS = 5;
const BODY_MIN = 10;
const BODY_MAX = 4000;

/* What each status is called on the customer's screen and in their emails. */
const CUSTOMER_LABEL = {
  new: 'Open',
  waiting: 'We’ve got a question for you',
  in_progress: 'Being built',
  done: 'Done',
  declined: 'Done'
};

function cleanBody(raw) {
  const body = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
  if (body.length < BODY_MIN) return { error: 'A sentence is plenty, but tell us a little more than that.' };
  if (body.length > BODY_MAX) return { error: 'Keep it under 4,000 characters.' };
  return { body };
}

/* Only paths the caller could have written: a customer's under their own
   id, ours under <user>/admin/. Anything else is a mistake or a probe. */
function cleanAttachments(raw, userId, admin) {
  const prefix = admin ? userId + '/admin/' : userId + '/';
  return (Array.isArray(raw) ? raw : [])
    .map((p) => String(p))
    .filter((p) => p.startsWith(prefix) && !p.includes('..'))
    .slice(0, MAX_ATTACHMENTS);
}

function nextStatus(request, author, wanted) {
  if (author === 'customer') {
    return request.status === 'in_progress' ? 'in_progress' : 'new';
  }
  return STATUSES.includes(wanted) ? wanted : 'waiting';
}

/* Writes the note and moves the request. Returns { note, request }. Throws
   on a database error; the callers turn that into a 500. */
async function addNote(db, request, { author, body, attachmentPaths, status, isPrivate, first }) {
  const now = new Date().toISOString();

  const { data: note, error: noteErr } = await db.from('request_notes').insert({
    request_id: request.id,
    author,
    body,
    private: !!isPrivate,
    attachment_paths: attachmentPaths && attachmentPaths.length ? attachmentPaths : null,
    // A private note is never emailed, so it is born already "sent".
    emailed_at: isPrivate ? now : null
  }).select().single();
  if (noteErr) throw new Error(noteErr.message);

  if (isPrivate) return { note, request };

  const to = nextStatus(request, author, status);
  const patch = { status: to, last_note_at: now, last_note_by: author };
  if (to === 'done' && request.status !== 'done') patch.done_at = now;
  if (to !== 'done') patch.done_at = null;
  // Our own note is read by us; theirs is new to them until they open it.
  if (author === 'customer') patch.customer_seen_at = now;

  const { data: updated, error: reqErr } = await db.from('requests')
    .update(patch).eq('id', request.id).select().single();
  if (reqErr) throw new Error(reqErr.message);

  const href = '/requests.html#r/' + request.id;
  const title = updated.title || 'your request';
  if (author === 'admin') {
    const heading = to === 'done' ? 'Done: ' + title
      : to === 'waiting' ? 'A quick question about ' + title
      : 'Update on ' + title;
    await notify(db, request.user_id, heading, body.slice(0, 200), href);
  } else {
    await notifyAdmin(db, (first ? 'New request: ' : 'Reply on ') + title, body.slice(0, 200), '/admin.html#r/' + request.id);
  }

  return { note, request: updated };
}

module.exports = {
  STATUSES, CUSTOMER_LABEL, MAX_ATTACHMENTS, BODY_MIN, BODY_MAX,
  cleanBody, cleanAttachments, addNote
};
