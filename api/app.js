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
const { missingEnv, adminEmails, ourSiteUrl } = require('./_env.js');
const { sitesFor, siteFor, isUuid } = require('./_mcp.js');
const { cleanBody, isOnline, addMessage } = require('./_chat.js');
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

  return {
    days,
    visitors: sessions(cur), views: cur.length,
    previous: { visitors: sessions(prev), views: prev.length },
    series: Object.keys(byDay).map((k) => ({ day: k, views: byDay[k].views, visitors: byDay[k].sessions.size })),
    pages: count(cur, 'path').map((x) => ({ path: x.key, views: x.n })),
    referrers: count(cur, 'referrer', 'session').map((x) => ({ host: x.key, visitors: x.n })),
    countries: count(cur, 'country', 'session').map((x) => ({ country: x.key, visitors: x.n })),
    devices
  };
}

async function analytics(db, site, daysIn) {
  const days = [7, 30, 90].includes(Number(daysIn)) ? Number(daysIn) : 30;
  const since = new Date(Date.now() - 2 * days * DAY).toISOString();
  const { data, error } = await db.from('page_views').select('session, path, referrer, device, country, created_at')
    .eq('site_id', site.id).gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  const out = summarise(data || [], days);

  // Open requests on this site, for the "work with us" tile.
  const { data: reqs } = await db.from('requests').select('id, status, site_id, user_id').eq('user_id', site.owner_id).limit(500);
  out.requests_open = (reqs || []).filter((r) => r.status !== 'done' && r.status !== 'declined').length;
  // Money in, once payments are connected (phase 3). Null says "not yet".
  out.payments = null;
  out.beacon_seen = (data || []).length > 0;
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
    const { data } = await db.from('sites').select('id, dashboard_url, modules, labels, deep_links').in('id', ids);
    (data || []).forEach((s) => { config[s.id] = s; });
  }
  const full = sites.map((s) => {
    const c = config[s.site_id] || {};
    return Object.assign({}, s, { dashboard_url: c.dashboard_url || null, modules: c.modules || [], labels: c.labels || {}, deep_links: c.deep_links || {} });
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
    id: c.id, name: c.visitor_name, email: c.visitor_email, phone: c.visitor_phone, page: c.page,
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

/* The owner's reply lands in the thread. It also goes by email when the
   owner asks, or when the visitor has gone and left an address: a reply
   nobody is there to read is a reply lost. */
async function chatReply(db, site, id, bodyIn, via) {
  const conv = await conversationIn(db, site, id);
  const text = cleanBody(bodyIn);
  if (text.length < 1) { const e = new Error('Write a reply first.'); e.shown = true; throw e; }
  if (conv.blocked_at) { const e = new Error('This visitor is blocked. Unblock them to reply.'); e.shown = true; throw e; }
  const made = await addMessage(db, conv, 'owner', text);
  const delivered = ['chat'];
  const wantsEmail = via === 'email' || (via !== 'chat' && !isOnline(conv) && !!conv.visitor_email);
  if (wantsEmail && conv.visitor_email) {
    const business = site.name || site.profile.business_name || 'us';
    const { data: recent } = await db.from('messages').select('author, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(6);
    const thread = (recent || []).reverse().filter((m) => m.id !== made.message.id);
    const lines = [esc(text).replace(/\n/g, '<br>')];
    if (thread.length) lines.push('<span style="color:#86868b;font-size:13px;">Earlier:</span><br>' + thread.map((m) => '<b>' + (m.author === 'owner' ? esc(business) : esc(conv.visitor_name || 'You')) + ':</b> ' + esc(m.body).replace(/\n/g, ' ')).join('<br>'));
    const result = await sendEmail({
      to: conv.visitor_email,
      subject: 'Reply from ' + business,
      replyTo: site.email || undefined,
      text: text + (thread.length ? '\n\nEarlier:\n' + thread.map((m) => (m.author === 'owner' ? business : conv.visitor_name || 'You') + ': ' + m.body).join('\n') : '') + '\n\nReply to this email to carry on.',
      html: emailHtml({ preheader: text.slice(0, 90), heading: 'A reply from ' + business, lines, footer: 'You messaged ' + business + ' on their website. Reply to this email to carry on the conversation.' }),
      headers: { 'Auto-Submitted': 'no' }
    });
    if (result === 'sent') { delivered.push('email'); await db.from('messages').update({ emailed_at: new Date().toISOString() }).eq('id', made.message.id); }
  }
  return { message: { id: made.message.id, author: 'owner', body: text, emailed: delivered.includes('email'), at: made.message.created_at }, delivered, conversation: convOut(made.conversation) };
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
    if (action === 'chat_set') { const site = await siteFor({ db }, caller, body.site_id); return res.status(200).json({ conversation: await chatSet(db, site, body.conversation_id, body) }); }

    if (action === 'dashboard') {
      const site = await siteFor({ db }, caller, body.site_id);
      if (!site.dashboard_url) return res.status(400).json({ error: 'This site has no dashboard connected yet.' });
      const path = cleanPath(body.path);
      // Minted for the caller, never for the site's owner on their behalf:
      // the admin arrives in a dashboard as themselves, and RLS there decides.
      const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: caller.email });
      const hashed = data && data.properties && data.properties.hashed_token;
      if (error || !hashed) throw new Error('handoff: ' + ((error && error.message) || 'no token'));
      return res.status(200).json({ url: site.dashboard_url.replace(/\/+$/, '') + path + '#kanvas_handoff=' + encodeURIComponent(hashed) });
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
module.exports.cleanPath = cleanPath;
