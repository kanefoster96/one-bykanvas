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
  declined: 'Cancelled'
};

/* files: how many attachments go with it. Photos can be sent on their own
   (or with a word or two), so the minimum only applies to words alone. */
function cleanBody(raw, files) {
  const body = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
  if (files > 0 && body.length < BODY_MIN) return { body: body || (files === 1 ? 'Sent a file.' : 'Sent ' + files + ' files.') };
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
    await notify(db, request.user_id, heading, body.slice(0, 200), href,
      { siteId: request.site_id || null, kind: 'support', deepLink: { kind: 'support', id: request.id } });
  } else {
    await notifyAdmin(db, (first ? 'New request: ' : 'Reply on ') + title, body.slice(0, 200), '/admin.html#r/' + request.id,
      { siteId: request.site_id || null, kind: 'support', deepLink: { kind: 'support', id: request.id } });
  }

  return { note, request: updated };
}

/* ---- changing a request after it was sent ----------------------------
 *
 * The first customer note is the request as they wrote it, and the row
 * holds the same words as detail (plus a title made from them). An edit
 * changes all three together, so the lists, the thread and the emails
 * agree. A title someone chose (a catalogue pick, or one we set) is kept
 * unless a new one is given.
 */
async function editRequest(db, row, { body, title }) {
  const madeTitle = String(row.detail || '').split('\n')[0].trim().slice(0, 80);
  const patch = { detail: body };
  if (title) patch.title = title;
  else if (!row.title || row.title === madeTitle) patch.title = body.split('\n')[0].trim().slice(0, 80);
  const { data: updated, error } = await db.from('requests').update(patch).eq('id', row.id).select().single();
  if (error) throw new Error(error.message);
  const { data: first } = await db.from('request_notes').select('id')
    .eq('request_id', row.id).eq('author', 'customer').order('created_at', { ascending: true }).limit(1);
  if (first && first.length) {
    const { error: nErr } = await db.from('request_notes').update({ body }).eq('id', first[0].id);
    if (nErr) throw new Error(nErr.message);
  }
  return updated;
}

/* The customer calls it off. Stored as declined (the status the table
   already allows), shown to both sides as Cancelled; a note says so in
   the thread, and a reply reopens it like any closed request. */
async function cancelRequest(db, row) {
  const now = new Date().toISOString();
  const { error: noteErr } = await db.from('request_notes').insert({
    request_id: row.id, author: 'customer', body: 'I\u2019ve cancelled this request.', private: false
  });
  if (noteErr) throw new Error(noteErr.message);
  const { data: updated, error } = await db.from('requests')
    .update({ status: 'declined', done_at: null, last_note_at: now, last_note_by: 'customer', customer_seen_at: now })
    .eq('id', row.id).select().single();
  if (error) throw new Error(error.message);
  await notifyAdmin(db, 'Cancelled: ' + (row.title || 'a request'), 'They cancelled it.', '/admin.html#r/' + row.id,
    { siteId: row.site_id || null, kind: 'support', deepLink: { kind: 'support', id: row.id } });
  return updated;
}

/* Gone for good: the row, its notes (the foreign key cascades) and every
   file attached to either. Never a request that was ever charged for. */
async function deleteRequest(db, row) {
  if (row.billed_at) { const e = new Error('This one was paid for, so it stays on record.'); e.shown = true; throw e; }
  const { data: notes } = await db.from('request_notes').select('attachment_paths').eq('request_id', row.id);
  const paths = Array.from(new Set([].concat(row.attachment_paths || [], ...(notes || []).map((n) => n.attachment_paths || []))));
  if (paths.length) {
    const { error: rmErr } = await db.storage.from('request-attachments').remove(paths);
    if (rmErr) console.error('requests: could not remove files for %s: %s', row.id, rmErr.message);
  }
  const { error } = await db.from('requests').delete().eq('id', row.id);
  if (error) throw new Error(error.message);
}

/* Every request with the newest public note under it: the admin inbox and
   the MCP inbox_list tool. */
async function listInbox(db, siteId) {
  let q = db.from('requests')
    .select('id, user_id, site_id, kind, title, detail, status, created_at, done_at, last_note_at, last_note_by, customer_seen_at')
    .order('last_note_at', { ascending: false, nullsFirst: false })
    .limit(500);
  /* Scoped at the query, not after: a site's caller never receives another
     site's rows to filter out. */
  if (siteId) q = q.eq('site_id', siteId);
  const { data: reqs, error: reqErr } = await q;
  if (reqErr) throw new Error(reqErr.message);

  const ids = (reqs || []).map((r) => r.id);
  const latest = {};
  if (ids.length) {
    const { data: notes, error: nErr } = await db.from('request_notes')
      .select('request_id, author, body, private, created_at')
      .in('request_id', ids)
      .order('created_at', { ascending: false })
      .limit(3000);
    if (nErr) throw new Error(nErr.message);
    (notes || []).forEach((n) => {
      if (!latest[n.request_id] && !n.private) latest[n.request_id] = n;
    });
  }

  const userIds = Array.from(new Set((reqs || []).map((r) => r.user_id)));
  let names = {};
  if (userIds.length) {
    const { data: profs, error: pErr } = await db.from('profiles')
      .select('id, business_name, contact_name, site_url').in('id', userIds);
    if (pErr) throw new Error(pErr.message);
    (profs || []).forEach((p) => { names[p.id] = p; });
  }

  const rows = (reqs || []).map((r) => {
    const p = names[r.user_id] || {};
    const n = latest[r.id];
    return {
      id: r.id, user_id: r.user_id, site_id: r.site_id, kind: r.kind, status: r.status,
      title: r.title || String(r.detail || '').split('\n')[0].slice(0, 120),
      created_at: r.created_at, done_at: r.done_at,
      last_note_at: r.last_note_at || r.created_at, last_note_by: r.last_note_by || 'customer',
      business_name: p.business_name || null, contact_name: p.contact_name || null,
      site_url: p.site_url || null,
      latest: n ? { author: n.author, body: String(n.body).split('\n')[0].slice(0, 140), created_at: n.created_at } : null
    };
  });
  return rows;
}

/* The whole conversation, private notes included, with the customer and
   a signed link for every attachment. Null when there is no such request. */
async function getThread(db, id) {
  const { data: reqRow, error: rErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!reqRow) return null;

  const { data: notes, error: nErr } = await db.from('request_notes')
    .select('id, author, body, private, attachment_paths, created_at')
    .eq('request_id', id).order('created_at', { ascending: true }).limit(500);
  if (nErr) throw new Error(nErr.message);

  const paths = (notes || []).flatMap((n) => n.attachment_paths || []);
  const signed = {};
  if (paths.length) {
    const { data: list, error: sErr } = await db.storage
      .from('request-attachments').createSignedUrls(paths, 3600);
    if (sErr) throw new Error(sErr.message);
    (list || []).forEach((x) => { if (x.signedUrl) signed[x.path] = x.signedUrl; });
  }
  (notes || []).forEach((n) => {
    n.attachments = (n.attachment_paths || []).map((p) => ({ path: p, url: signed[p] })).filter((a) => a.url);
    delete n.attachment_paths;
  });

  const { data: prof } = await db.from('profiles')
    .select('id, business_name, contact_name, site_url, site_status, active_plan').eq('id', reqRow.user_id).maybeSingle();
  let email = null;
  try {
    const { data: u } = await db.auth.admin.getUserById(reqRow.user_id);
    email = u && u.user && u.user.email;
  } catch (e) { /* the thread still shows without it */ }

  return {
    request: {
      id: reqRow.id, user_id: reqRow.user_id, site_id: reqRow.site_id, kind: reqRow.kind, status: reqRow.status,
      title: reqRow.title || String(reqRow.detail || '').split('\n')[0].slice(0, 120),
      created_at: reqRow.created_at, done_at: reqRow.done_at,
      last_note_at: reqRow.last_note_at, last_note_by: reqRow.last_note_by
    },
    customer: Object.assign({ email }, prof || {}),
    notes: notes || []
  };
}

/* The site a customer's request belongs to. One site per customer today,
   with the profile's id as the site id; made on first sight for an account
   that predates the sites table, so a request never lacks a site. */
async function siteForUser(db, userId) {
  const { data: mine } = await db.from('sites').select('id').eq('owner_id', userId).order('created_at', { ascending: true }).limit(1);
  if (mine && mine.length) return mine[0].id;
  const { data: p } = await db.from('profiles').select('business_name, site_url, site_status').eq('id', userId).maybeSingle();
  const { data: made, error } = await db.from('sites')
    .insert({ id: userId, owner_id: userId, name: (p && p.business_name) || '', url: (p && p.site_url) || null, status: (p && p.site_status) || 'building' })
    .select('id').single();
  if (error) { console.error('requests: could not make a site row:', error.message); return null; }
  return made.id;
}

/* The two other kinds of outstanding work, so the app's inbox is every job
   in one place: customers whose plan is live but whose site is not yet
   (a build owed), and free examples asked for and not yet sent. Neither is
   a request row, so listInbox alone would never show them. Oldest first,
   because the one who has waited longest is the one to do next. */
async function listJobs(db) {
  const [builds, designs] = await Promise.all([
    db.from('profiles')
      .select('id, business_name, contact_name, phone, business_type, active_plan, site_url, '
            + 'requested_domain, domain_owned, site_goals, site_uses, services, existing_links, created_at')
      .not('active_plan', 'is', null).eq('site_status', 'building')
      .order('created_at', { ascending: true }).limit(100),
    db.from('leads')
      .select('id, name, business, email, handle, requested_domain, about, created_at')
      .eq('source', 'free-preview').is('preview_sent_at', null)
      .order('created_at', { ascending: true }).limit(200)
  ]);
  if (builds.error) throw new Error(builds.error.message);
  if (designs.error) throw new Error(designs.error.message);

  /* Emails live in auth.users. Best effort, one lookup per build - there
     are never many, and a build without an email still shows. */
  const rows = builds.data || [];
  for (const p of rows) {
    try {
      const { data } = await db.auth.admin.getUserById(p.id);
      p.email = (data && data.user && data.user.email) || null;
    } catch (e) { p.email = null; }
  }
  return { builds: rows, designs: designs.data || [] };
}

module.exports = {
  STATUSES, CUSTOMER_LABEL, MAX_ATTACHMENTS, BODY_MIN, BODY_MAX,
  cleanBody, cleanAttachments, addNote, listInbox, listJobs, getThread, siteForUser,
  editRequest, cancelRequest, deleteRequest
};
