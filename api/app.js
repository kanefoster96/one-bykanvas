/* The One app's API: who am I, my site, my numbers, my feed, my phone.
 *
 * Every call carries the customer's Supabase session. The site in hand is
 * checked against the caller on every action through the same siteFor the
 * MCP server uses, so the app and Claude can never disagree about whose
 * site is whose. Reads that the browser could do itself under row level
 * security still come through here so the app has one door and one shape.
 *
 * The dashboard handoff (opening the customer's own dashboard inside the
 * app, already signed in) is deliberately not here yet: it is designed
 * and agreed first, then added as one action.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, adminEmails } = require('./_env.js');
const { sitesFor, siteFor, isUuid } = require('./_mcp.js');

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

async function me(db, caller) {
  const sites = await sitesFor({ db }, caller);
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

  const { data: reqs } = await db.from('requests').select('id, last_note_at, customer_seen_at, last_note_by').eq('user_id', caller.user_id).eq('last_note_by', 'admin').limit(200);
  const requestsUnread = (reqs || []).filter((r) => !r.customer_seen_at || new Date(r.customer_seen_at) < new Date(r.last_note_at)).length;

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
