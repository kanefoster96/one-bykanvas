/* The One app's API: who am I, my site, my numbers, my feed, my phone.
 *
 * Every call carries the customer's Supabase session. The site in hand is
 * checked against the caller on every action through the same siteFor the
 * MCP server uses, so the app and Claude can never disagree about whose
 * site is whose. Reads that the browser could do itself under row level
 * security still come through here so the app has one door and one shape.
 *
 * The dashboard handoff: the app opens the customer's own dashboard, on
 * its own domain, already signed in. The app never hands its session
 * over. It asks here for a single-use magic-link token minted for the
 * caller, carries it to the dashboard in the URL fragment (never sent to
 * a server, never logged), and kanvas-handoff.js on the dashboard swaps
 * it for a session of its own. See `dashboard` below.
 */
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { missingEnv, adminEmails, ourSiteUrl } = require('./_env.js');
const { notifyAdmin } = require('./_notify.js');
const { sitesFor, siteFor, isUuid } = require('./_mcp.js');
const { cleanBody, isOnline, addMessage } = require('./_chat.js');
const { sendSms, placeCall } = require('./_twilio.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc } = require('./_email_template.js');

const DAY = 86400000;
const MAX_ROWS = 50000;

/* ---------------------------------------------------------- analytics -- */

function dayKey(iso) { return String(iso).slice(0, 10); }

/* Two windows of page views, this one and the one before, into the
   numbers the Analytics tab shows. Pure, so it is tested on its own. */
function summarise(rows, days, now) {
  const end = now || Date.now();
  const start = end - days * DAY;
  const prevStart = start - days * DAY;
  const cur = [], prev = [];
  rows.forEach((r) => {
    const t = new Date(r.created_at).getTime();
    if (t >= start) cur.push(r); else if (t >= prevStart) prev.push(r);
  });
  const sessions = (list) => new Set(list.map((r) => r.session)).size;

  const byDay = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * DAY);
    byDay[dayKey(d.toISOString())] = { day: dayKey(d.toISOString()), views: 0, sessions: new Set() };
  }
  cur.forEach((r) => { const k = byDay[dayKey(r.created_at)]; if (k) { k.views++; k.sessions.add(r.session); } });

  const count = (list, key, by) => {
    const m = {};
    list.forEach((r) => { const v = r[key]; if (!v) return; if (by === 'session') { (m[v] = m[v] || new Set()).add(r.session); } else m[v] = (m[v] || 0) + 1; });
    return Object.keys(m).map((k) => ({ key: k, n: by === 'session' ? m[k].size : m[k] })).sort((a, b) => b.n - a.n).slice(0, 10);
  };

  const devices = { phone: 0, desktop: 0 };
  const seen = new Set();
  cur.forEach((r) => { if (seen.has(r.session)) return; seen.add(r.session); devices[r.device === 'phone' ? 'phone' : 'desktop']++; });

  // On the site now: a page view in the last five minutes.
  const online = new Set();
  cur.forEach((r) => { if (end - new Date(r.created_at).getTime() < 5 * 60000) online.add(r.session); });

  return {
    days,
    visitors: sessions(cur), views: cur.length,
    online_now: online.size,
    previous: { visitors: sessions(prev), views: prev.length },
    series: Object.keys(byDay).map((k) => ({ day: k, views: byDay[k].views, visitors: byDay[k].sessions.size })),
    pages: count(cur, 'path').map((x) => ({ path: x.key, views: x.n })),
    referrers: count(cur, 'referrer', 'session').map((x) => ({ host: x.key, visitors: x.n })),
    countries: count(cur, 'country', 'session').map((x) => ({ country: x.key, visitors: x.n })),
    devices,
    journeys: journeys(cur)
  };
}

/* The routes visitors take: each visit's pages in order, repeats of the
   same page collapsed, the first four steps. The commonest routes of two
   pages or more, plus how many pages a visit runs to. */
function journeys(list) {
  const bySession = {};
  list.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((r) => { (bySession[r.session] = bySession[r.session] || []).push(r.path); });
  const routes = {};
  let pages = 0, visits = 0, bounced = 0;
  Object.keys(bySession).forEach((s) => {
    const steps = bySession[s].filter((p, i, a) => i === 0 || p !== a[i - 1]);
    visits++; pages += steps.length;
    if (steps.length < 2) { bounced++; return; }
    const key = steps.slice(0, 4).join('\n');
    routes[key] = (routes[key] || 0) + 1;
  });
  return {
    top: Object.keys(routes).map((k) => ({ steps: k.split('\n'), visitors: routes[k] })).sort((a, b) => b.visitors - a.visitors).slice(0, 6),
    pages_per_visit: visits ? Math.round((pages / visits) * 10) / 10 : 0,
    one_page_pct: visits ? Math.round((bounced / visits) * 100) : 0
  };
}

function inWindow(list, field, days, now) {
  const end = now || Date.now(), start = end - days * DAY, prevStart = start - days * DAY;
  const cur = [], prev = [];
  list.forEach((r) => { const t = new Date(r[field]).getTime(); if (t >= start) cur.push(r); else if (t >= prevStart) prev.push(r); });
  return { cur, prev };
}

/* Who paid: one person per email where given, else per visit. */
function payerKey(p) { return p.customer_email ? 'e:' + p.customer_email.toLowerCase() : p.session ? 's:' + p.session : 'r:' + p.ref; }

/* Money in over the window against the one before. Pure. */
function money(pays, days, now) {
  const { cur, prev } = inWindow(pays, 'paid_at', days, now);
  const net = (l) => l.reduce((n, p) => n + Math.max(0, (p.amount_pence || 0) - (p.refunded_pence || 0)), 0);
  const refunded = cur.reduce((n, p) => n + (p.refunded_pence || 0), 0);
  return {
    count: cur.length, amount: net(cur), refunded, refunds: cur.filter((p) => p.refunded_pence > 0).length,
    payers: new Set(cur.map(payerKey)).size,
    average: cur.length ? Math.round(net(cur) / cur.length) : 0,
    currency: (cur[0] || prev[0] || {}).currency || 'gbp',
    previous: { count: prev.length, amount: net(prev) }
  };
}

/* From a visit to a payment: how many visited, how many of them wrote in
   the chat, how many paid, and how many of those who wrote went on to
   pay. A chat is tied to a payment by the visit it started in or by the
   email left in both. Pure. */
function funnel(views, convs, pays, days, now) {
  const v = inWindow(views, 'created_at', days, now).cur;
  const c = inWindow(convs, 'created_at', days, now).cur;
  const p = inWindow(pays, 'paid_at', days, now).cur;
  const paySessions = new Set(p.map((x) => x.session).filter(Boolean));
  const payEmails = new Set(p.map((x) => x.customer_email && x.customer_email.toLowerCase()).filter(Boolean));
  const messagedAndPaid = c.filter((x) => (x.session && paySessions.has(x.session)) || (x.visitor_email && payEmails.has(String(x.visitor_email).toLowerCase()))).length;
  return {
    visitors: new Set(v.map((x) => x.session)).size,
    messaged: c.length,
    paid: new Set(p.map(payerKey)).size,
    messaged_and_paid: messagedAndPaid
  };
}

async function analytics(db, site, daysIn) {
  const days = [7, 30, 90].includes(Number(daysIn)) ? Number(daysIn) : 30;
  const since = new Date(Date.now() - 2 * days * DAY).toISOString();
  const [views, pays, convs] = await Promise.all([
    db.from('page_views').select('session, path, referrer, device, country, created_at').eq('site_id', site.id).gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS),
    db.from('payments').select('ref, amount_pence, refunded_pence, currency, customer_email, session, paid_at').eq('site_id', site.id).gte('paid_at', since).order('paid_at', { ascending: false }).limit(MAX_ROWS),
    db.from('conversations').select('id, session, visitor_email, channel, created_at').eq('site_id', site.id).gte('created_at', since).limit(MAX_ROWS)
  ]);
  if (views.error) throw new Error(views.error.message);
  const rows = views.data || [], payRows = pays.data || [], convRows = (convs.data || []).filter((c) => !c.channel || c.channel === 'web');
  const modules = site.modules || [];
  const out = summarise(rows, days);
  out.beacon_seen = rows.length > 0;

  // Payments and chat show only on sites that have them. A site with
  // payment rows has them whether or not the module was ticked.
  out.has_payments = modules.includes('payments') || payRows.length > 0;
  out.has_chat = modules.includes('chat') || convRows.length > 0;
  out.money = out.has_payments ? money(payRows, days) : null;
  if (out.has_chat) {
    const c = inWindow(convRows, 'created_at', days);
    out.chat = { conversations: c.cur.length, previous: { conversations: c.prev.length } };
  } else out.chat = null;
  out.funnel = (out.has_payments || out.has_chat) ? funnel(rows, convRows, payRows, days) : null;
  return out;
}

/* ---------------------------------------------------------------- me -- */

/* The admin uses the app like a customer does, on their own site too:
   kanvas.one's chat and visitors. The row is made on first sight, with
   the admin's user id as its id, like every other site. */
async function ownSiteForAdmin(db, caller) {
  const { data: mine } = await db.from('sites').select('id').eq('owner_id', caller.user_id).limit(1);
  if (mine && mine.length) return;
  const { error } = await db.from('sites').insert({ id: caller.user_id, owner_id: caller.user_id, name: 'Kanvas One', url: ourSiteUrl(), status: 'live', modules: ['chat'] });
  if (error) console.error('app: could not make the admin site row:', error.message);
}

async function me(db, caller) {
  if (caller.is_admin) await ownSiteForAdmin(db, caller);
  let sites = await sitesFor({ db }, caller);
  // Their own first, then everyone else's by name.
  sites = sites.slice().sort((a, b) => (a.owner_id === caller.user_id ? -1 : b.owner_id === caller.user_id ? 1 : String(a.name).localeCompare(String(b.name))));
  const ids = sites.map((s) => s.site_id);
  const config = {};
  if (ids.length) {
    const { data } = await db.from('sites').select('id, dashboard_url, modules, labels, deep_links, phone_number').in('id', ids);
    (data || []).forEach((s) => { config[s.id] = s; });
  }
  const full = sites.map((s) => {
    const c = config[s.site_id] || {};
    return Object.assign({}, s, { dashboard_url: c.dashboard_url || null, modules: c.modules || [], labels: c.labels || {}, deep_links: c.deep_links || {}, phone_number: c.phone_number || null });
  });

  const { data: prof } = await db.from('profiles').select('notifications_seen_at, active_plan, business_name').eq('id', caller.user_id).maybeSingle();
  const seenAt = prof && prof.notifications_seen_at ? new Date(prof.notifications_seen_at) : new Date(0);
  let nq = db.from('notifications').select('id, created_at').gt('created_at', seenAt.toISOString()).limit(100);
  nq = caller.is_admin ? nq.eq('for_admin', true) : nq.eq('user_id', caller.user_id);
  const { data: fresh } = await nq;

  let requestsUnread = 0;
  if (caller.is_admin) {
    // Waiting on Kane: the customer spoke last and it is not finished.
    const { data: reqs } = await db.from('requests').select('id, status, last_note_by').eq('last_note_by', 'customer').limit(500);
    requestsUnread = (reqs || []).filter((r) => r.status !== 'done' && r.status !== 'declined').length;
  } else {
    const { data: reqs } = await db.from('requests').select('id, last_note_at, customer_seen_at, last_note_by').eq('user_id', caller.user_id).eq('last_note_by', 'admin').limit(200);
    requestsUnread = (reqs || []).filter((r) => !r.customer_seen_at || new Date(r.customer_seen_at) < new Date(r.last_note_at)).length;
  }

  return {
    user: { id: caller.user_id, email: caller.email, is_admin: caller.is_admin, plan: (prof && prof.active_plan) || null },
    sites: full,
    unread: { notifications: (fresh || []).length, requests: requestsUnread }
  };
}

/* ------------------------------------------------------------- feed -- */

async function events(db, caller, siteId) {
  let q = db.from('notifications').select('id, site_id, kind, title, body, href, deep_link, created_at')
    .order('created_at', { ascending: false }).limit(60);
  q = caller.is_admin ? q.eq('for_admin', true) : q.eq('user_id', caller.user_id);
  if (siteId && isUuid(siteId)) q = q.eq('site_id', siteId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

/* -------------------------------------------------------------- chat -- */

function convOut(c, now) {
  return {
    id: c.id, channel: c.channel || 'web', name: c.visitor_name, email: c.visitor_email, phone: c.visitor_phone, page: c.page,
    status: c.status, blocked: !!c.blocked_at, online: isOnline(c, now),
    last_at: c.last_message_at, last_by: c.last_message_by, preview: c.last_message_preview,
    unread: c.last_message_by === 'visitor' && (!c.owner_seen_at || new Date(c.owner_seen_at) < new Date(c.last_message_at)),
    created_at: c.created_at
  };
}

async function conversationIn(db, site, id) {
  if (!isUuid(id)) { const e = new Error('Which conversation?'); e.shown = true; throw e; }
  const { data } = await db.from('conversations').select('*').eq('id', id).maybeSingle();
  if (!data || data.site_id !== site.id) { const e = new Error('Permission denied: that conversation is not on this site.'); e.shown = true; e.code = 'PERMISSION_DENIED'; throw e; }
  return data;
}

async function chatList(db, site) {
  const { data, error } = await db.from('conversations').select('*').eq('site_id', site.id).order('last_message_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const now = Date.now();
  return (data || []).map((c) => convOut(c, now));
}

async function chatGet(db, site, id) {
  const conv = await conversationIn(db, site, id);
  const { data: msgs } = await db.from('messages').select('id, author, body, emailed_at, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(300);
  const now = new Date().toISOString();
  if (conv.last_message_by === 'visitor') await db.from('conversations').update({ owner_seen_at: now }).eq('id', conv.id);
  return { conversation: convOut(conv), messages: (msgs || []).map((m) => ({ id: m.id, author: m.author, body: m.body, emailed: !!m.emailed_at, at: m.created_at })) };
}

/* Where a visitor's reply to one of our emails should go: a per-conversation
   address on the reply domain, which api/email-inbound.js turns back into a
   message in the thread. Without that domain set up, replies go to the
   business's own inbox instead. */
function replyAddressFor(conv, site) {
  const domain = String(process.env.CHAT_REPLY_DOMAIN || '').trim().toLowerCase();
  if (domain) return 'reply+' + conv.id + '@' + domain;
  return site.email || undefined;
}

/* The link in the email that lands the visitor back in the chat: the page
   they were on, with the widget told to open. Only their own browser still
   holds the thread, so the email also works as a plain reply. */
function continueLink(conv, site) {
  const base = String(site.url || (site.profile && site.profile.site_url) || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return null;
  const page = /^\/[^\s?#]*$/.test(String(conv.page || '')) ? conv.page : '/';
  return base + page + '?k1chat=open';
}

/* The owner's reply lands in the thread. Whether it also goes by email is
   the owner's choice in the app (via = 'chat' | 'email'), with one rule
   over the top: a visitor who has left the site and left an address is
   always emailed, whichever button was pressed, because a reply nobody is
   there to read is a reply lost. Text and WhatsApp threads take no typed
   replies: texts are for automations only, to keep costs down. */
async function chatReply(db, site, id, bodyIn, via) {
  const conv = await conversationIn(db, site, id);
  const text = cleanBody(bodyIn);
  if (text.length < 1) { const e = new Error('Write a reply first.'); e.shown = true; throw e; }
  if (conv.blocked_at) { const e = new Error('This visitor is blocked. Unblock them to reply.'); e.shown = true; throw e; }
  const channel = conv.channel || 'web';
  if (channel === 'sms' || channel === 'whatsapp') {
    const e = new Error('Texts are automated only. Call them back, or email them if they left an address.'); e.shown = true; throw e;
  }
  if (via === 'email' && !conv.visitor_email) {
    const e = new Error('They did not leave an email address, so this can only go to the chat. They will see it when they come back.'); e.shown = true; throw e;
  }
  const online = isOnline(conv);
  const made = await addMessage(db, conv, 'owner', text);
  const delivered = ['chat'];
  const wantsEmail = !!conv.visitor_email && (via === 'email' || !online);
  if (wantsEmail) {
    const business = site.name || site.profile.business_name || 'us';
    const { data: recent } = await db.from('messages').select('id, author, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(6);
    const thread = (recent || []).reverse().filter((m) => m.id !== made.message.id && m.author !== 'system');
    const link = continueLink(conv, site);
    const lines = [esc(text).replace(/\n/g, '<br>')];
    if (thread.length) lines.push('<span style="color:#86868b;font-size:13px;">Earlier:</span><br>' + thread.map((m) => '<b>' + (m.author === 'owner' ? esc(business) : esc(conv.visitor_name || 'You')) + ':</b> ' + esc(m.body).replace(/\n/g, ' ')).join('<br>'));
    const howToReply = 'Reply to this email and it goes straight back to ' + business + (link ? ', or carry on in the chat on their site.' : '.');
    const result = await sendEmail({
      to: conv.visitor_email,
      subject: 'Reply from ' + business,
      replyTo: replyAddressFor(conv, site),
      text: text + (thread.length ? '\n\nEarlier:\n' + thread.map((m) => (m.author === 'owner' ? business : conv.visitor_name || 'You') + ': ' + m.body).join('\n') : '') + '\n\n' + howToReply + (link ? '\n' + link : ''),
      html: emailHtml({
        preheader: text.slice(0, 90), heading: 'A reply from ' + business, lines,
        ctaText: link ? 'Continue the chat' : undefined, ctaHref: link || undefined,
        ctaNote: link ? 'Opens the chat on ' + business + '’s website, where your conversation is waiting.' : undefined,
        footer: 'You messaged ' + business + ' on their website. ' + howToReply
      }),
      headers: { 'Auto-Submitted': 'no' }
    });
    if (result === 'sent') { delivered.push('email'); await db.from('messages').update({ emailed_at: new Date().toISOString() }).eq('id', made.message.id); }
  }
  return { message: { id: made.message.id, author: 'owner', body: text, emailed: delivered.includes('email'), at: made.message.created_at }, delivered, online, conversation: convOut(made.conversation) };
}

/* The owner calls a customer from the app, showing the site's number.
   Twilio rings the owner's mobile first; when they answer, the bridge
   dials the customer. */
async function callBack(db, site, id, toIn) {
  if (!site.phone_number || !site.forward_to) { const e = new Error('Calling from the business number needs the site\u2019s number and your mobile set up first.'); e.shown = true; throw e; }
  let to = null;
  if (id) { const conv = await conversationIn(db, site, id); to = conv.visitor_phone; }
  else to = String(toIn || '').trim();
  if (!/^\+\d{8,15}$/.test(String(to || ''))) { const e = new Error('No number to call on this conversation.'); e.shown = true; throw e; }
  const url = ourSiteUrl() + '/api/twilio/bridge?site=' + encodeURIComponent(site.id) + '&to=' + encodeURIComponent(to);
  const r = await placeCall({ from: site.phone_number, to: site.forward_to, url });
  if (!r.ok) { const e = new Error(r.error || 'Could not place the call.'); e.shown = true; throw e; }
  await db.from('call_log').insert({ site_id: site.id, kind: 'call_out', from_number: to });
  return { ok: true, ringing: site.forward_to, to };
}

async function chatSet(db, site, id, patchIn) {
  const conv = await conversationIn(db, site, id);
  const patch = {};
  if (patchIn.status === 'open' || patchIn.status === 'closed') patch.status = patchIn.status;
  if (typeof patchIn.blocked === 'boolean') patch.blocked_at = patchIn.blocked ? new Date().toISOString() : null;
  if (!Object.keys(patch).length) return convOut(conv);
  const { data, error } = await db.from('conversations').update(patch).eq('id', conv.id).select().single();
  if (error) throw new Error(error.message);
  return convOut(data);
}

/* A place inside the dashboard: a path only, so a deep link can never
   point the frame somewhere else. Anything odd becomes the front door. */
function cleanPath(p) {
  const s = String(p || '/').trim();
  if (!/^\/(?!\/)[^\s#]*$/.test(s) || /[<>"'\\]/.test(s) || /^\/\S*:\/\//.test(s)) return '/';
  return s.slice(0, 300);
}

/* ----------------------------------------------------- delete account -- */

/* Closing an account for good, from inside the app: both stores require
   it (Apple 5.1.1(v), Google Play's data deletion policy). In order:
   cancel any live Stripe subscription, so a card is never charged for a
   site nobody can see; clear their uploaded files; tell the admin; then
   delete the login, which takes the profile, site, requests, chats, page
   views and device tokens with it by cascade. Billing records stay in
   Stripe, which is the accounting record. The admin's own account is
   refused: removing it is an operational decision, not a personal one. */
async function deleteAccount(db, caller) {
  if (caller.is_admin) { const e = new Error('The admin account cannot be deleted from the app.'); e.shown = true; throw e; }
  const { data: prof } = await db.from('profiles').select('business_name, stripe_subscription_id').eq('id', caller.user_id).maybeSingle();
  if (prof && prof.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try { await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.cancel(prof.stripe_subscription_id); }
    catch (err) {
      if (!err || err.code !== 'resource_missing') {
        console.error('delete_account: subscription cancel failed:', err && err.message);
        const e = new Error('Your plan could not be cancelled just now, so nothing was deleted. Try again in a minute, or email support@kanvas.one.'); e.shown = true; throw e;
      }
    }
  }
  try {
    const { data: files } = await db.storage.from('request-attachments').list(caller.user_id, { limit: 1000 });
    const paths = (files || []).filter((f) => f.name).map((f) => caller.user_id + '/' + f.name);
    if (paths.length) await db.storage.from('request-attachments').remove(paths);
  } catch (err) { console.error('delete_account: files:', err && err.message); }
  await notifyAdmin(db, 'Account deleted', ((prof && prof.business_name) || caller.email) + ' deleted their account from the app.');
  const { error } = await db.auth.admin.deleteUser(caller.user_id);
  if (error) throw new Error('delete: ' + error.message);
  return { ok: true };
}

/* ---------------------------------------------------------- handler -- */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('app: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in.' });
    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) return res.status(401).json({ error: 'Your session has expired.' });
    const user = userData.user;
    const email = String(user.email || '').toLowerCase();
    const caller = { user_id: user.id, email, is_admin: adminEmails().includes(email), via: 'app' };

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const action = String(body.action || '');

    if (action === 'me') return res.status(200).json(await me(db, caller));

    if (action === 'analytics') {
      const site = await siteFor({ db }, caller, body.site_id);
      return res.status(200).json(await analytics(db, site, body.days));
    }

    if (action === 'events') return res.status(200).json({ events: await events(db, caller, body.site_id) });

    if (action === 'chat_list') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json({ conversations: await chatList(db, site) }); }
    if (action === 'chat_get') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json(await chatGet(db, site, body.conversation_id)); }
    if (action === 'chat_reply') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json(await chatReply(db, site, body.conversation_id, body.body, body.via)); }
    if (action === 'call_back') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json(await callBack(db, site, body.conversation_id, body.to)); }
    if (action === 'chat_set') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json({ conversation: await chatSet(db, site, body.conversation_id, body) }); }

    if (action === 'dashboard') {
      const site = await siteFor({ db }, caller, body.site_id);
      if (!site.dashboard_url) return res.status(400).json({ error: 'This site has no dashboard connected yet.' });
      const path = cleanPath(body.path);
      // A dashboard address may name a page (kanvas.one/admin.html); a deep
      // link path then replaces the page, the front door keeps it.
      const base = site.dashboard_url.replace(/\/+$/, '');
      const target = path === '/' ? base : base.replace(/\/[^/]*\.html?$/i, '') + path;
      // Our own pages share the app's origin, so the session is already
      // there: no token to mint, nothing to hand off.
      let sameOrigin = false;
      try { sameOrigin = new URL(base).origin === new URL(ourSiteUrl()).origin; } catch (e) { sameOrigin = false; }
      if (sameOrigin) return res.status(200).json({ url: target });
      // Minted for the caller, never for the site's owner on their behalf:
      // the admin arrives in a dashboard as themselves, and RLS there decides.
      const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: caller.email });
      const hashed = data && data.properties && data.properties.hashed_token;
      if (error || !hashed) throw new Error('handoff: ' + ((error && error.message) || 'no token'));
      return res.status(200).json({ url: target + '#kanvas_handoff=' + encodeURIComponent(hashed) });
    }

    if (action === 'seen') {
      await db.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', user.id);
      return res.status(200).json({ ok: true });
    }

    if (action === 'device') {
      const platform = String(body.platform || '');
      const deviceToken = String(body.token || '').trim();
      if (!['ios', 'android', 'web'].includes(platform)) return res.status(400).json({ error: 'Unknown platform.' });
      if (deviceToken.length < 20 || deviceToken.length > 4096) return res.status(400).json({ error: 'That does not look like a device token.' });
      const row = { user_id: user.id, is_admin: caller.is_admin, platform, token: deviceToken, app_version: String(body.app_version || '').slice(0, 40) || null, last_seen_at: new Date().toISOString(), failed_at: null };
      const { error } = await db.from('device_tokens').upsert(row, { onConflict: 'token' });
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_account') return res.status(200).json(await deleteAccount(db, caller));

    if (action === 'device_remove') {
      const deviceToken = String(body.token || '').trim();
      if (deviceToken) await db.from('device_tokens').delete().eq('token', deviceToken).eq('user_id', user.id);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    if (err && err.code === 'PERMISSION_DENIED') return res.status(403).json({ error: err.message });
    if (err && err.shown) return res.status(400).json({ error: err.message });
    console.error('app:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};

module.exports.summarise = summarise;
module.exports.money = money;
module.exports.funnel = funnel;
module.exports.cleanPath = cleanPath;
