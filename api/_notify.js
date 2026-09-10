/* Notifications, both directions, on the phone and in the app.
 *
 * notify()      - a row for one customer: "your request was accepted".
 * notifyAdmin() - a row for the admin: "a new customer joined". Admin rows
 *                 carry for_admin=true and no user_id; row level security
 *                 shows them only to the admin email.
 * event()       - a typed event on a site (money in, work to do, time
 *                 booked, new person, chat, review), worded with the site's
 *                 own labels and carrying a deep link to the record. This is
 *                 what the One app is built around.
 *
 * Every row is also pushed to the owner's phones through _push.js, when
 * push is configured. Written only with the service role - the table
 * deliberately has no insert policy, so nobody can hand themselves good
 * news. Every call is best effort: the action it reports has already
 * happened, and a missed notification must never fail it.
 */
const { pushTo, devicesFor } = require('./_push.js');

/* What each business calls things, unless the site says otherwise. Keys
   are event kinds; the site's `labels` column overrides any of them:
   a cafe says {"work":"order"}, a salon {"person":"client"}. */
const DEFAULT_LABELS = {
  money_in: 'payment', work: 'job', booking: 'booking', person: 'customer',
  chat: 'message', review: 'review', support: 'request'
};

function money(pence, currency) {
  const n = Number(pence || 0) / 100;
  const sym = { gbp: '£', usd: '$', eur: '€' }[String(currency || 'gbp').toLowerCase()] || '';
  return sym + n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function trim(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* One template per kind. `d` is the event's data; `L` the merged labels. */
const TEMPLATES = {
  money_in: (d, L) => ({
    title: money(d.amount, d.currency) + (d.name ? ' from ' + d.name : ' received'),
    body: cap(L.money_in) + (d.what ? ' for ' + d.what : '') + (d.method ? ' · ' + d.method : '')
  }),
  money_failed: (d, L) => ({
    title: cap(L.money_in) + ' failed' + (d.name ? ': ' + d.name : ''),
    body: money(d.amount, d.currency) + (d.what ? ' for ' + d.what : '') + (d.reason ? ' · ' + d.reason : '')
  }),
  money_refund: (d, L) => ({
    title: 'Refunded ' + money(d.amount, d.currency) + (d.name ? ' to ' + d.name : ''),
    body: d.what ? cap(L.money_in) + ' for ' + d.what : cap(L.money_in) + ' refunded'
  }),
  money_cancelled: (d, L) => ({
    title: cap(L.booking) + ' cancelled' + (d.name ? ': ' + d.name : ''),
    body: [d.what, d.when].filter(Boolean).join(' · ') || 'Cancelled by the customer'
  }),
  work: (d, L) => ({
    title: 'New ' + L.work + (d.title ? ': ' + trim(d.title, 60) : ''),
    body: [d.name, d.when, d.where].filter(Boolean).join(' · ') || trim(d.detail, 120)
  }),
  booking: (d, L) => ({
    title: cap(L.booking) + ' booked' + (d.name ? ': ' + d.name : ''),
    body: [d.what, d.when].filter(Boolean).join(' · ') || 'Open the app for the details'
  }),
  person: (d, L) => ({
    title: 'New ' + L.person + (d.name ? ': ' + d.name : ''),
    body: [d.email, d.phone, d.source].filter(Boolean).join(' · ') || 'Signed up on your site'
  }),
  chat: (d) => ({
    title: d.name || 'Visitor on your site',
    body: trim(d.preview, 140) || 'Sent you a message'
  }),
  review: (d, L) => ({
    title: 'New ' + L.review + (d.stars ? ': ' + '★'.repeat(Math.max(1, Math.min(5, Number(d.stars)))) : '') + (d.name ? ' from ' + d.name : ''),
    body: trim(d.text, 140) || 'Tap to read it'
  }),
  support: (d) => ({ title: d.title || 'Update on your request', body: trim(d.body, 200) })
};

function wording(kind, data, siteLabels) {
  const L = Object.assign({}, DEFAULT_LABELS, siteLabels || {});
  const t = TEMPLATES[kind];
  if (!t) return { title: cap(kind), body: '' };
  const out = t(data || {}, L);
  return { title: String(out.title).slice(0, 120), body: String(out.body || '').slice(0, 500) };
}

async function insertRow(db, row) {
  const { data, error } = await db.from('notifications').insert(row).select('id').maybeSingle();
  if (error) { console.error('notify: notification not written:', error.message); return null; }
  return data;
}

/* Data for the push: what the app needs to open the right place on tap. */
function pushData(row) {
  return { kind: row.kind || 'note', site_id: row.site_id || '', href: row.href || '', deep_link: row.deep_link || null, id: row.id || '' };
}

async function push(db, who, row) {
  try {
    const devices = await devicesFor(db, who);
    if (!devices.length) return;
    const r = await pushTo(db, devices, { title: row.title, body: row.body, data: pushData(row), thread: row.site_id || undefined });
    if (r.sent && row.id) await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', row.id);
  } catch (err) { console.error('notify: push:', err.message); }
}

/* opts: { siteId, kind, deepLink } - all optional, for the app's feed. */
async function notify(db, userId, title, body, href, opts) {
  const o = opts || {};
  const row = {
    user_id: userId,
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 500) : null,
    href: href || null,
    site_id: o.siteId || null,
    kind: o.kind || null,
    deep_link: o.deepLink || null
  };
  const made = await insertRow(db, row);
  await push(db, userId, Object.assign({}, row, { id: made && made.id }));
}

async function notifyAdmin(db, title, body, href, opts) {
  const o = opts || {};
  const row = {
    user_id: null,
    for_admin: true,
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 500) : null,
    href: href || '/admin.html',
    site_id: o.siteId || null,
    kind: o.kind || null,
    deep_link: o.deepLink || null
  };
  const made = await insertRow(db, row);
  await push(db, 'admin', Object.assign({}, row, { id: made && made.id }));
}

/* A typed event on a site. Looks up the site's owner and labels, words it,
   works out the deep link from the site's deep_links map, writes the row
   and pushes it.
     event(db, siteId, 'money_in', { amount: 4800, currency: 'gbp', name: 'Beth Ward', what: 'Cut and beard', record: 'payment', id: 'pi_123' })
   record + id become the deep link: the app opens the dashboard at
   deep_links[record] with {id} filled in, or the chat natively. */
async function event(db, siteId, kind, data) {
  const d = data || {};
  const { data: site, error } = await db.from('sites').select('id, owner_id, labels, deep_links, dashboard_url').eq('id', siteId).maybeSingle();
  if (error || !site) { console.error('notify: event on unknown site', siteId, error && error.message); return null; }
  const w = wording(kind, d, site.labels);
  const deepLink = linkFor(site, d.record || kind, d.id);
  await notify(db, site.owner_id, w.title, w.body, deepLink && deepLink.path ? (site.dashboard_url || '') + deepLink.path : null,
    { siteId: site.id, kind, deepLink });
  return w;
}

function linkFor(site, record, id) {
  if (!record) return null;
  if (record === 'chat') return { kind: 'chat', id: id || null };
  const map = (site && site.deep_links) || {};
  const pattern = map[record];
  const path = pattern && id != null ? String(pattern).replace('{id}', encodeURIComponent(String(id))) : (pattern && !/\{id\}/.test(pattern) ? pattern : null);
  return { kind: record, id: id == null ? null : String(id), path };
}

module.exports = { notify, notifyAdmin, event, wording, linkFor, DEFAULT_LABELS, money };
