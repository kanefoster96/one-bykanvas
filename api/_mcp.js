/* The MCP server: kanvas.one from a Claude chat, one site at a time.
 *
 * Multi-tenant. A call arrives with a token and is resolved to a Kanvas
 * One user account: a personal token minted from the account page, a
 * Supabase session (the in-app assistant), or the admin token. The
 * caller is then either the admin, who may talk about every site, or a
 * customer, who may talk only about sites they own. list_sites says which
 * those are; every other site tool takes a site_id, and the server loads
 * that site and checks it belongs to the caller before reading or writing
 * anything. A site that is not theirs is a permission error, not an empty
 * answer. Queries are then scoped to that site at the query, and where a
 * Supabase JWT secret is available a customer's reads run through a
 * client signed as them, so row level security enforces the same thing
 * inside the database.
 *
 * Every write is two calls. The first validates, loads the live record
 * and parks a plain-English preview in mcp_pending_actions with the
 * caller and the site; confirm(id) runs it once within ten minutes, and
 * only for the user who previewed it. Everything confirmed lands in
 * mcp_actions. Twenty confirmations an hour per user. MCP_READ_ONLY
 * refuses every write unless it is exactly "false".
 *
 * The transport is thin on purpose: resolveCaller + callTool + toolsFor
 * are the whole server, so an in-app assistant can call them with the
 * signed-in user's session and get exactly the same behaviour.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { missingEnv, ourSiteUrl, adminEmails } = require('./_env.js');
const { PLANS, REQUEST_COST } = require('./_plans.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { notify } = require('./_notify.js');
const { addNote, listInbox, getThread, cleanBody, siteForUser } = require('./_requests.js');
const { pointsWindowStart } = require('./_billing.js');
const { notifySiteLive } = require('./_site_live.js');
const { sendLeadPreview } = require('./_previews.js');
const { changePlan } = require('./_change_plan.js');

const PROTOCOL = '2025-06-18';
const SERVER_INFO = { name: 'kanvas-one', version: '2.0.0' };
const PENDING_MINUTES = 10;
const HOURLY_LIMIT = 20;
const TOKEN_PREFIX = 'k1_';
const PLAN_NAME = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'Max' };
const STATUS_WORD = { new: 'Open', waiting: 'Waiting on customer', in_progress: 'In progress', done: 'Done', declined: 'Done' };
const CUSTOMER_STATUS = { new: 'Open', waiting: 'Kane has a question for you', in_progress: 'Being built', done: 'Done', declined: 'Done' };

/* ------------------------------------------------------------- errors -- */

function fail(message) { const e = new Error(message); e.shown = true; return e; }
function denied(message) { const e = new Error(message || 'Permission denied: that site is not yours.'); e.shown = true; e.code = 'PERMISSION_DENIED'; return e; }

/* ------------------------------------------------------------ helpers -- */

function money(pence) { return '£' + (Number(pence || 0) / 100).toFixed(2); }
function when(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function readOnly() { return String(process.env.MCP_READ_ONLY || '').toLowerCase() !== 'false'; }
function who(p) { return (p && (p.business_name || p.contact_name)) || 'this customer'; }
function person(p, email) { return p && p.contact_name && p.business_name ? p.contact_name + ' (' + p.business_name + ')' : who(p) + (email ? ' <' + email + '>' : ''); }
function paragraphs(text) { return String(text).replace(/\r\n/g, '\n').split(/\n{2,}/).map((t) => esc(t.trim()).replace(/\n/g, '<br>')).filter(Boolean); }

function ctxFor() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY } = process.env;
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let stripeClient = null;
  return {
    db,
    site: ourSiteUrl(),
    stripe() {
      if (!STRIPE_SECRET_KEY) throw fail('Stripe is not configured on this deployment.');
      if (!stripeClient) stripeClient = new Stripe(STRIPE_SECRET_KEY);
      return stripeClient;
    }
  };
}

async function emailOf(ctx, userId) {
  try { const { data } = await ctx.db.auth.admin.getUserById(userId); return (data && data.user && data.user.email) || null; }
  catch (e) { return null; }
}

/* ---------------------------------------------------------------- auth -- */

/* Turns whatever the transport found into a caller, or null.
 *   k1_...            a personal token from the account page (hash lookup)
 *   MCP_ADMIN_TOKEN   the admin's standing token (resolves to the admin account)
 *   anything else     a Supabase access token, i.e. a signed-in session
 * A caller is { user_id, email, is_admin, via }. */
async function resolveCaller(ctx, given) {
  const token = String(given || '').trim();
  if (!token) return null;
  const admins = adminEmails();

  const adminToken = process.env.MCP_ADMIN_TOKEN || '';
  if (adminToken.length >= 24 && same(token, adminToken)) {
    let userId = null;
    try {
      for (let page = 1; page <= 5 && !userId; page++) {
        const { data } = await ctx.db.auth.admin.listUsers({ page, perPage: 200 });
        const users = (data && data.users) || [];
        const hit = users.find((u) => admins.includes(String(u.email || '').toLowerCase()));
        if (hit) userId = hit.id;
        if (users.length < 200) break;
      }
    } catch (e) { /* the admin token still works without an account row */ }
    return { user_id: userId, email: admins[0], is_admin: true, via: 'admin_token' };
  }

  if (token.startsWith(TOKEN_PREFIX)) {
    const { data: row } = await ctx.db.from('mcp_tokens').select('id, user_id, revoked_at').eq('token_hash', sha(token)).maybeSingle();
    if (!row || row.revoked_at) return null;
    const email = await emailOf(ctx, row.user_id);
    ctx.db.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id).then(() => {}, () => {});
    return { user_id: row.user_id, email, is_admin: !!email && admins.includes(email.toLowerCase()), via: 'token' };
  }

  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_PUBLISHABLE_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data || !data.user || !data.user.email_confirmed_at) return null;
    const email = data.user.email || null;
    return { user_id: data.user.id, email, is_admin: !!email && admins.includes(email.toLowerCase()), via: 'session' };
  } catch (e) { return null; }
}

/* A Supabase client that reads as the caller, so the database's own row
   level security decides what comes back. Needs the project's JWT secret
   to sign a short-lived token; without it, reads fall back to the service
   role with every query still scoped by site here. */
function readerFor(ctx, caller) {
  if (ctx._reader !== undefined) return ctx._reader;
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_JWT_SECRET } = process.env;
  if (caller.is_admin || !caller.user_id || !SUPABASE_JWT_SECRET || !SUPABASE_PUBLISHABLE_KEY) { ctx._reader = null; return null; }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: caller.user_id, email: caller.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 300 });
  const sig = crypto.createHmac('sha256', SUPABASE_JWT_SECRET).update(head + '.' + body).digest('base64url');
  ctx._reader = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + head + '.' + body + '.' + sig } }
  });
  return ctx._reader;
}

/* --------------------------------------------------------------- sites -- */

async function sitesFor(ctx, caller) {
  const reader = readerFor(ctx, caller) || ctx.db;
  let q = reader.from('sites').select('id, owner_id, name, url, status, created_at').order('created_at', { ascending: true }).limit(500);
  if (!caller.is_admin) q = q.eq('owner_id', caller.user_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let sites = data || [];
  // A customer from before the sites table: make their site on first sight.
  if (!sites.length && !caller.is_admin && caller.user_id) {
    const id = await siteForUser(ctx.db, caller.user_id);
    if (id) { const { data: made } = await ctx.db.from('sites').select('id, owner_id, name, url, status, created_at').eq('id', id); sites = made || []; }
  }
  const owners = Array.from(new Set(sites.map((s) => s.owner_id)));
  const plans = {};
  if (owners.length) {
    const { data: profs } = await ctx.db.from('profiles').select('id, business_name, active_plan, subscription_status').in('id', owners);
    (profs || []).forEach((p) => { plans[p.id] = p; });
  }
  return sites.map((s) => {
    const p = plans[s.owner_id] || {};
    return { site_id: s.id, name: s.name || p.business_name || '', url: s.url, status: s.status, plan: PLAN_NAME[p.active_plan] || null, subscription: p.subscription_status || 'none', role: caller.is_admin && s.owner_id !== caller.user_id ? 'admin' : 'owner', owner_id: s.owner_id };
  });
}

/* The one check every site tool runs first. Loads the site, refuses it
   if the caller does not own it (admins own everything), and attaches the
   owner's profile and email for the tools to use. */
async function siteFor(ctx, caller, siteId) {
  if (!isUuid(siteId)) throw fail('Which site? Pass site_id from list_sites.');
  const { data: site, error } = await ctx.db.from('sites').select('*').eq('id', siteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!site) throw denied('Permission denied: no site of yours has that id.');
  if (!caller.is_admin && site.owner_id !== caller.user_id) throw denied();
  const { data: profile } = await ctx.db.from('profiles').select('*').eq('id', site.owner_id).maybeSingle();
  const email = await emailOf(ctx, site.owner_id);
  return Object.assign({}, site, { profile: profile || {}, email, site_id: site.id });
}

/* A request must belong to the site in hand, or it is not seen. */
async function requestIn(ctx, site, requestId) {
  if (!isUuid(requestId)) throw fail('Which request? Pass request_id from inbox_list.');
  const t = await getThread(ctx.db, requestId);
  const belongs = t && (t.request.site_id ? t.request.site_id === site.id : t.request.user_id === site.owner_id);
  if (!belongs) throw denied('Permission denied: that request is not on this site.');
  return t;
}

function threadOut(t, caller) {
  const notes = t.notes.filter((n) => caller.is_admin || !n.private);
  return {
    request: Object.assign({}, t.request, { status: (caller.is_admin ? STATUS_WORD : CUSTOMER_STATUS)[t.request.status] || t.request.status }),
    customer: caller.is_admin ? { customer_id: t.customer.id, business: t.customer.business_name, name: t.customer.contact_name, email: t.customer.email, plan: PLAN_NAME[t.customer.active_plan] || null } : undefined,
    notes: notes.map((n) => ({ by: n.author === 'admin' ? (caller.is_admin ? 'me' : 'Kane') : (caller.is_admin ? 'customer' : 'you'), private: !!n.private || undefined, text: n.body, attachments: (n.attachments || []).map((x) => x.url), at: n.created_at }))
  };
}

function invoiceRow(inv) {
  const charge = inv.charge && typeof inv.charge === 'object' ? inv.charge : null;
  const line = inv.lines && inv.lines.data && inv.lines.data[0];
  return {
    payment_id: inv.id, number: inv.number, status: inv.status,
    amount: money(inv.amount_paid || inv.amount_due), refunded: charge ? money(charge.amount_refunded) : null,
    date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    description: line ? line.description : null, receipt: inv.hosted_invoice_url || null
  };
}

async function subscriptionOf(ctx, site) {
  const p = site.profile;
  if (!p.stripe_subscription_id) return { plan: PLAN_NAME[p.active_plan] || null, status: p.subscription_status || 'none', renews: p.current_period_end || null, cancel_at_period_end: false };
  try {
    const s = await ctx.stripe().subscriptions.retrieve(p.stripe_subscription_id);
    const item = s.items && s.items.data && s.items.data[0];
    const end = s.cancel_at || s.current_period_end || (item && item.current_period_end) || null;
    return { plan: PLAN_NAME[p.active_plan] || null, status: s.status, interval: item && item.price && item.price.recurring ? item.price.recurring.interval : null, amount: item && item.price ? money(item.price.unit_amount) : null, renews: end ? new Date(end * 1000).toISOString() : null, cancel_at_period_end: !!s.cancel_at_period_end };
  } catch (e) {
    return { plan: PLAN_NAME[p.active_plan] || null, status: p.subscription_status || 'none', renews: p.current_period_end || null, cancel_at_period_end: false };
  }
}

async function partnerBalances(ctx) {
  const [ps, pays, outs] = await Promise.all([
    ctx.db.from('partners').select('id, name, contact, code, rate_percent, rate_pence, created_at').order('created_at', { ascending: true }),
    ctx.db.from('partner_payments').select('partner_id, user_id, amount_pence, created_at').limit(5000),
    ctx.db.from('partner_payouts').select('partner_id, amount_pence, created_at').limit(5000)
  ]);
  if (ps.error) throw new Error(ps.error.message);
  if (pays.error) throw new Error(pays.error.message);
  if (outs.error) throw new Error(outs.error.message);
  const monthKey = (d) => { const t = new Date(d); return t.getUTCFullYear() + '-' + (t.getUTCMonth() + 1); };
  const nowKey = monthKey(new Date());
  return (ps.data || []).map((partner) => {
    const mine = (pays.data || []).filter((r) => r.partner_id === partner.id);
    const earned = mine.reduce((s, r) => s + r.amount_pence, 0);
    const paid = (outs.data || []).filter((r) => r.partner_id === partner.id).reduce((s, r) => s + r.amount_pence, 0);
    const thisMonth = mine.filter((r) => monthKey(r.created_at) === nowKey).reduce((s, r) => s + r.amount_pence, 0);
    return { partner_id: partner.id, name: partner.name, contact: partner.contact, code: partner.code, earned: money(earned), paid: money(paid), owed: money(earned - paid), owed_pence: earned - paid, this_month: money(thisMonth), customers: new Set(mine.map((r) => r.user_id)).size };
  });
}

async function chargeFor(ctx, paymentId) {
  const id = String(paymentId || '').trim();
  const stripe = ctx.stripe();
  if (/^ch_/.test(id)) return stripe.charges.retrieve(id);
  if (/^pi_/.test(id)) {
    const pi = await stripe.paymentIntents.retrieve(id);
    const ch = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge && pi.latest_charge.id);
    if (!ch) throw fail('That payment has no charge to refund yet.');
    return stripe.charges.retrieve(ch);
  }
  if (/^in_/.test(id)) {
    const inv = await stripe.invoices.retrieve(id);
    const ch = typeof inv.charge === 'string' ? inv.charge : (inv.charge && inv.charge.id);
    if (ch) return stripe.charges.retrieve(ch);
    const piId = typeof inv.payment_intent === 'string' ? inv.payment_intent : (inv.payment_intent && inv.payment_intent.id);
    if (piId) return chargeFor(ctx, piId);
    throw fail('That invoice has not been paid, so there is nothing to refund.');
  }
  throw fail('payment_id should be an invoice (in_), payment intent (pi_) or charge (ch_) id.');
}

const SITE_ARG = { site_id: { type: 'string', description: 'from list_sites' } };
function withSite(props, required) { return { type: 'object', properties: Object.assign({}, SITE_ARG, props || {}), required: ['site_id'].concat(required || []) }; }

/* ---------------------------------------------------------- read tools -- */
/* who: 'any' (owner or admin) or 'admin'. scope: 'site' means the first
   argument is a site_id that must belong to the caller. */

const readTools = {
  list_sites: {
    who: 'any', scope: 'none',
    description: 'The sites you can talk about. Customers see the sites they own; the admin sees every site. Every other tool takes one of these site_ids.',
    input: { type: 'object', properties: {} },
    async run(ctx, caller) { return (await sitesFor(ctx, caller)).map(({ owner_id, ...s }) => s); }
  },

  site_summary: {
    who: 'any', scope: 'site',
    description: 'One site at a glance: plan, subscription, site status, open requests and whose turn it is.',
    input: withSite(),
    async run(ctx, caller, a, site) {
      const rows = await listInbox(ctx.db, site.id);
      const open = rows.filter((r) => r.status !== 'done' && r.status !== 'declined');
      const sub = await subscriptionOf(ctx, site);
      const out = {
        site_id: site.id, name: site.name || site.profile.business_name, url: site.url || site.profile.site_url, site_status: site.status,
        plan: sub.plan, subscription: sub.status, renews: sub.renews, cancel_at_period_end: sub.cancel_at_period_end,
        open_requests: open.length,
        waiting_on: caller.is_admin
          ? { me: open.filter((r) => r.last_note_by === 'customer').length, customer: open.filter((r) => r.last_note_by === 'admin').length }
          : { you: open.filter((r) => r.last_note_by === 'admin').length, kane: open.filter((r) => r.last_note_by === 'customer').length }
      };
      if (site.profile.active_plan === 'starter') {
        const since = pointsWindowStart(site.profile).toISOString();
        const { count } = await ctx.db.from('requests').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('kind', 'edit').gte('created_at', since);
        out.starter_change_this_month = (count || 0) >= 1 ? 'used' : 'available';
      }
      if (caller.is_admin) out.customer = { customer_id: site.owner_id, name: site.profile.contact_name, email: site.email, admin_notes: site.profile.admin_notes || null };
      return out;
    }
  },

  inbox_list: {
    who: 'any', scope: 'site',
    description: 'This site’s requests (messages and website edit requests) with the newest note each, whoever’s turn it is first. filter: mine | in_progress | waiting | done | all.',
    input: withSite({ filter: { type: 'string', enum: ['mine', 'in_progress', 'waiting', 'done', 'all'] } }),
    async run(ctx, caller, a, site) {
      const rows = await listInbox(ctx.db, site.id);
      const filter = a.filter || 'all';
      const done = (r) => r.status === 'done' || r.status === 'declined';
      const myTurn = (r) => !done(r) && (caller.is_admin ? r.last_note_by === 'customer' : r.last_note_by === 'admin');
      const rank = (r) => myTurn(r) ? 0 : r.status === 'in_progress' ? 1 : done(r) ? 3 : 2;
      return rows.filter((r) => {
        if (filter === 'mine' && !myTurn(r)) return false;
        if (filter === 'in_progress' && r.status !== 'in_progress') return false;
        if (filter === 'waiting' && rank(r) !== 2) return false;
        if (filter === 'done' && !done(r)) return false;
        return true;
      }).sort((x, y) => rank(x) - rank(y) || new Date(y.last_note_at) - new Date(x.last_note_at)).slice(0, 100)
        .map((r) => ({
          request_id: r.id, title: r.title, kind: r.kind,
          status: (caller.is_admin ? STATUS_WORD : CUSTOMER_STATUS)[r.status] || r.status,
          whose_turn: done(r) ? 'nobody' : myTurn(r) ? (caller.is_admin ? 'me' : 'you') : (caller.is_admin ? 'customer' : 'Kane'),
          last_note: r.latest ? { by: r.latest.author === 'admin' ? (caller.is_admin ? 'me' : 'Kane') : (caller.is_admin ? 'customer' : 'you'), text: r.latest.body, at: r.latest.created_at } : null,
          last_activity: r.last_note_at
        }));
    }
  },

  request_get: {
    who: 'any', scope: 'site',
    description: 'One request in full, the thread oldest first. Customers see their conversation with Kane; the admin also sees private notes.',
    input: withSite({ request_id: { type: 'string' } }, ['request_id']),
    async run(ctx, caller, a, site) { return threadOut(await requestIn(ctx, site, a.request_id), caller); }
  },

  orders_list: {
    who: 'any', scope: 'site',
    description: 'This site’s payments: Stripe invoices with amount, status, date and refunds. since is an ISO date.',
    input: withSite({ since: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } }),
    async run(ctx, caller, a, site) {
      if (!site.profile.stripe_customer_id) return [];
      const args = { customer: site.profile.stripe_customer_id, limit: Math.min(Number(a.limit) || 25, 100), expand: ['data.charge'] };
      if (a.since) { const d = new Date(a.since); if (!isNaN(d)) args.created = { gte: Math.floor(d.getTime() / 1000) }; }
      let inv;
      try { inv = await ctx.stripe().invoices.list(args); }
      catch (e) { delete args.expand; inv = await ctx.stripe().invoices.list(args); }
      return (inv.data || []).map(invoiceRow);
    }
  },

  membership_get: {
    who: 'any', scope: 'site',
    description: 'This site’s subscription: plan, monthly or annual, status, when it renews, whether it is set to end.',
    input: withSite(),
    async run(ctx, caller, a, site) { return Object.assign({ site_id: site.id }, await subscriptionOf(ctx, site)); }
  },

  actions_recent: {
    who: 'any', scope: 'none',
    description: 'What has been done from chat on a site: the audit log of confirmed actions, newest first. The admin may leave site_id out to see everything.',
    input: { type: 'object', properties: Object.assign({}, SITE_ARG, { limit: { type: 'integer', minimum: 1, maximum: 100 } }) },
    async run(ctx, caller, a) {
      let q = ctx.db.from('mcp_actions').select('id, tool, preview, result, site_id, created_at').order('created_at', { ascending: false }).limit(Math.min(Number(a.limit) || 20, 100));
      if (a.site_id || !caller.is_admin) { const site = await siteFor(ctx, caller, a.site_id); q = q.eq('site_id', site.id); }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    }
  },

  /* ---- admin only, not about one site ---- */
  summary: {
    who: 'admin', scope: 'none',
    description: 'Admin: the numbers at the top of the admin page across every site.',
    input: { type: 'object', properties: {} },
    async run(ctx) {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();
      const [all, paying, live, open, leads, previews] = await Promise.all([
        ctx.db.from('profiles').select('id', { count: 'exact', head: true }),
        ctx.db.from('profiles').select('id', { count: 'exact', head: true }).in('subscription_status', ['active', 'trialing']),
        ctx.db.from('profiles').select('id', { count: 'exact', head: true }).eq('site_status', 'live'),
        ctx.db.from('requests').select('id, status, last_note_by').in('status', ['new', 'waiting', 'in_progress']),
        ctx.db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', iso),
        ctx.db.from('leads').select('id', { count: 'exact', head: true }).eq('source', 'free-preview').is('preview_sent_at', null)
      ]);
      const openRows = open.data || [];
      return { signed_up: all.count || 0, paying: paying.count || 0, live_sites: live.count || 0, open_requests: openRows.length, waiting_on_me: openRows.filter((r) => r.last_note_by === 'customer').length, leads_this_month: leads.count || 0, free_examples_waiting: previews.count || 0 };
    }
  },

  customers_list: {
    who: 'admin', scope: 'none',
    description: 'Admin: customers and sign-ups with their site_id. search matches business, name or email; plan: starter | business | max; status: paying | not_paying | live | building.',
    input: { type: 'object', properties: { search: { type: 'string' }, plan: { type: 'string', enum: ['starter', 'business', 'max'] }, status: { type: 'string', enum: ['paying', 'not_paying', 'live', 'building'] } } },
    async run(ctx, caller, a) {
      const sites = await sitesFor(ctx, caller);
      const bySite = {}; sites.forEach((s) => { bySite[s.owner_id] = s.site_id; });
      const { data, error } = await ctx.db.from('profiles').select('id, business_name, contact_name, business_type, active_plan, subscription_status, current_period_end, site_url, site_status, created_at').order('created_at', { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      const emails = {};
      for (let page = 1; page <= 5; page++) {
        const { data: u } = await ctx.db.auth.admin.listUsers({ page, perPage: 200 });
        const users = (u && u.users) || [];
        users.forEach((x) => { emails[x.id] = x.email; });
        if (users.length < 200) break;
      }
      const q = String(a.search || '').toLowerCase();
      return (data || []).map((p) => Object.assign({ email: emails[p.id] || null }, p)).filter((p) => {
        const paying = p.subscription_status === 'active' || p.subscription_status === 'trialing';
        if (a.plan && p.active_plan !== a.plan) return false;
        if (a.status === 'paying' && !paying) return false;
        if (a.status === 'not_paying' && paying) return false;
        if (a.status === 'live' && p.site_status !== 'live') return false;
        if (a.status === 'building' && p.site_status !== 'building') return false;
        if (q && !((p.business_name || '') + ' ' + (p.contact_name || '') + ' ' + (p.email || '')).toLowerCase().includes(q)) return false;
        return true;
      }).slice(0, 200).map((p) => ({ site_id: bySite[p.id] || null, customer_id: p.id, business: p.business_name, name: p.contact_name, email: p.email, type: p.business_type, plan: PLAN_NAME[p.active_plan] || null, subscription: p.subscription_status || 'none', renews: p.current_period_end, site_url: p.site_url, site_status: p.site_status, joined: p.created_at }));
    }
  },

  memberships_list: {
    who: 'admin', scope: 'none',
    description: 'Admin: every subscription from Stripe joined to its site. status: active | cancelling | past_due | canceled | all.',
    input: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'cancelling', 'past_due', 'canceled', 'all'] } } },
    async run(ctx, caller, a) {
      const subs = await ctx.stripe().subscriptions.list({ status: 'all', limit: 100 });
      const ids = (subs.data || []).map((s) => s.id);
      const { data: profs } = ids.length ? await ctx.db.from('profiles').select('id, business_name, contact_name, active_plan, stripe_subscription_id').in('stripe_subscription_id', ids) : { data: [] };
      const bySub = {}; (profs || []).forEach((p) => { bySub[p.stripe_subscription_id] = p; });
      const want = a.status || 'active';
      return (subs.data || []).map((s) => {
        const item = s.items && s.items.data && s.items.data[0];
        const p = bySub[s.id] || {};
        const end = s.current_period_end || (item && item.current_period_end) || null;
        return { site_id: p.id || null, customer: p.business_name || p.contact_name || null, plan: PLAN_NAME[(s.metadata && s.metadata.plan) || p.active_plan] || null, interval: item && item.price && item.price.recurring ? item.price.recurring.interval : null, amount: item && item.price ? money(item.price.unit_amount) : null, status: s.status, cancel_at_period_end: !!s.cancel_at_period_end, renews: end ? new Date(end * 1000).toISOString() : null };
      }).filter((r) => want === 'all' ? true : want === 'cancelling' ? (r.cancel_at_period_end && r.status === 'active') : want === 'active' ? (r.status === 'active' || r.status === 'trialing') : r.status === want);
    }
  },

  leads_list: {
    who: 'admin', scope: 'none',
    description: 'Admin: free example page enquiries. stage: waiting | sent | all.',
    input: { type: 'object', properties: { stage: { type: 'string', enum: ['waiting', 'sent', 'all'] } } },
    async run(ctx, caller, a) {
      const { data, error } = await ctx.db.from('leads').select('id, business, email, source, handle, requested_domain, preview_url, preview_sent_at, created_at').order('created_at', { ascending: false }).limit(300);
      if (error) throw new Error(error.message);
      const stage = a.stage || 'all';
      return (data || []).filter((l) => stage === 'all' ? true : stage === 'sent' ? !!l.preview_sent_at : (l.source === 'free-preview' && !l.preview_sent_at))
        .map((l) => ({ lead_id: l.id, business: l.business, email: l.email, source: l.source, handle: l.handle, wanted_domain: l.requested_domain, example_url: l.preview_url, example_sent: l.preview_sent_at, asked: l.created_at }));
    }
  },

  partners_list: {
    who: 'admin', scope: 'none',
    description: 'Admin: partner balances.',
    input: { type: 'object', properties: {} },
    async run(ctx) { return partnerBalances(ctx); }
  }
};

/* --------------------------------------------------------- write tools -- */
/* preview(ctx, caller, args, site) -> { preview, args } with args
   normalised to exactly what execute(ctx, caller, args, site) will use.
   execute re-checks the live record before doing anything. */

const writeTools = {
  request_reply: {
    who: 'any', scope: 'site',
    description: 'Reply on a request. A customer’s reply goes to Kane; Kane’s reply goes to the customer’s dashboard and, ten minutes later, their email. Admin only: status (waiting | in_progress | done) and private: true.',
    input: withSite({ request_id: { type: 'string' }, body: { type: 'string' }, status: { type: 'string', enum: ['waiting', 'in_progress', 'done'] }, private: { type: 'boolean' } }, ['request_id', 'body']),
    async preview(ctx, caller, a, site) {
      const t = await requestIn(ctx, site, a.request_id);
      const cleaned = cleanBody(a.body);
      if (cleaned.error) throw fail(cleaned.error);
      const text = cleaned.body;
      if (!caller.is_admin) {
        return { preview: 'Send this reply to Kane on “' + t.request.title + '”. He sees it in his inbox now and gets an email in about ten minutes.\n\n“' + text + '”', args: { request_id: t.request.id, body: text, author: 'customer' } };
      }
      const isPrivate = !!a.private;
      const status = isPrivate ? null : (a.status || 'waiting');
      const c = t.customer;
      const preview = isPrivate
        ? 'Private note on “' + t.request.title + '” (' + person(c, c.email) + '). Only I see it, no email, status stays ' + (STATUS_WORD[t.request.status] || t.request.status) + '.\n\n“' + text + '”'
        : 'Reply to ' + person(c, c.email) + ' on “' + t.request.title + '”. Status becomes ' + STATUS_WORD[status] + '. They see it in their dashboard now and get an email in about ten minutes.\n\n“' + text + '”';
      return { preview, args: { request_id: t.request.id, body: text, status, private: isPrivate, author: 'admin' } };
    },
    async execute(ctx, caller, a) {
      const { data: row, error } = await ctx.db.from('requests').select('*').eq('id', a.request_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw fail('That request is gone.');
      const out = await addNote(ctx.db, row, { author: a.author, body: a.body, isPrivate: !!a.private, status: a.status || undefined });
      if (a.author === 'admin' && !a.private && out.request.status === 'done' && row.status !== 'done' && row.kind === 'feature') {
        const featName = String(out.request.title || row.detail).split('\n')[0].trim().slice(0, 200);
        const { data: existing } = await ctx.db.from('site_features').select('id').eq('user_id', row.user_id).ilike('name', featName).limit(1);
        if (existing && existing.length) await ctx.db.from('site_features').update({ updated_at: new Date().toISOString() }).eq('id', existing[0].id);
        else await ctx.db.from('site_features').insert({ user_id: row.user_id, name: featName });
      }
      return { note_id: out.note.id, status: STATUS_WORD[out.request.status] };
    }
  },

  request_new: {
    who: 'any', scope: 'site',
    description: 'Start a new request on a site: kind edit (a change to what is on the site) or feature (something new). Starter sites get one edit a month.',
    input: withSite({ kind: { type: 'string', enum: ['edit', 'feature'] }, title: { type: 'string' }, body: { type: 'string' } }, ['kind', 'body']),
    async preview(ctx, caller, a, site) {
      const kind = a.kind === 'feature' ? 'feature' : 'edit';
      const cleaned = cleanBody(a.body);
      if (cleaned.error) throw fail(cleaned.error);
      let title = String(a.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!title) title = cleaned.body.split('\n')[0].trim().slice(0, 80);
      if (kind === 'edit' && site.profile.active_plan === 'starter') {
        const since = pointsWindowStart(site.profile).toISOString();
        const { count } = await ctx.db.from('requests').select('id', { count: 'exact', head: true }).eq('user_id', site.owner_id).eq('kind', 'edit').gte('created_at', since);
        if ((count || 0) >= 1) throw fail('That is this month’s change on Starter. The next one comes with the next payment, or Business has unlimited changes.');
      }
      return { preview: 'Open a new ' + kind + ' request on ' + (site.name || who(site.profile)) + ' titled “' + title + '”' + (caller.is_admin ? ' on the customer’s behalf' : '') + '. Kane sees it in his inbox now and gets an email in about ten minutes.\n\n“' + cleaned.body + '”', args: { kind, title, body: cleaned.body, as_admin: caller.is_admin } };
    },
    async execute(ctx, caller, a, site) {
      const { data: row, error } = await ctx.db.from('requests').insert({ user_id: site.owner_id, site_id: site.id, kind: a.kind, points: REQUEST_COST[a.kind].points, title: a.title, detail: a.body }).select().single();
      if (error) throw new Error(error.message);
      const out = await addNote(ctx.db, row, { author: 'customer', body: a.body, first: true });
      return { request_id: out.request.id, status: CUSTOMER_STATUS[out.request.status] };
    }
  },

  request_set_status: {
    who: 'admin', scope: 'site',
    description: 'Admin: move a request to Open (new) or In progress without a note.',
    input: withSite({ request_id: { type: 'string' }, status: { type: 'string', enum: ['new', 'in_progress'] } }, ['request_id', 'status']),
    async preview(ctx, caller, a, site) {
      const t = await requestIn(ctx, site, a.request_id);
      if (!['new', 'in_progress'].includes(a.status)) throw fail('Only Open (new) or In progress here. Use request_reply for the others.');
      return { preview: 'Set “' + t.request.title + '” (' + person(t.customer, t.customer.email) + ') from ' + (STATUS_WORD[t.request.status] || t.request.status) + ' to ' + STATUS_WORD[a.status] + '. No email.', args: { request_id: t.request.id, status: a.status } };
    },
    async execute(ctx, caller, a) {
      const { data: row } = await ctx.db.from('requests').select('id, user_id, title, status').eq('id', a.request_id).maybeSingle();
      if (!row) throw fail('That request is gone.');
      const { error } = await ctx.db.from('requests').update({ status: a.status, done_at: null }).eq('id', a.request_id);
      if (error) throw new Error(error.message);
      if (a.status === 'in_progress' && row.status !== 'in_progress') await notify(ctx.db, row.user_id, 'Being built: ' + (row.title || 'your request'), 'We’re on it now.', '/requests.html#r/' + row.id);
      return { status: STATUS_WORD[a.status] };
    }
  },

  membership_change_plan: {
    who: 'any', scope: 'site',
    description: 'Move this site to another plan: starter | business | max. Upgrades bill the difference now; downgrades wait for the renewal.',
    input: withSite({ plan: { type: 'string', enum: ['starter', 'business', 'max'] } }, ['plan']),
    async preview(ctx, caller, a, site) {
      if (!PLANS[a.plan] || a.plan === 'pro') throw fail('Plans are starter, business or max.');
      let pv;
      try { pv = await changePlan(ctx.stripe(), ctx.db, site.owner_id, site.profile, a.plan, false); }
      catch (e) { if (e.httpStatus) throw fail(e.message); throw e; }
      const name = caller.is_admin ? person(site.profile, site.email) : 'your site';
      const line = pv.upgrading
        ? 'Upgrade ' + name + ' from ' + PLAN_NAME[pv.from] + ' to ' + PLAN_NAME[pv.to] + ' now. Stripe charges the difference today' + (typeof pv.dueNow === 'number' ? ', ' + money(pv.dueNow) : '') + ', then ' + money(PLANS[a.plan].amount) + ' a month from the next renewal. The card on file must go through or nothing changes.'
        : 'Move ' + name + ' from ' + PLAN_NAME[pv.from] + ' down to ' + PLAN_NAME[pv.to] + ' from the next renewal' + (pv.renewsAt ? ' on ' + when(new Date(pv.renewsAt * 1000).toISOString()) : '') + '. Nothing charged now; the current plan runs until then.';
      return { preview: line, args: { plan: a.plan } };
    },
    async execute(ctx, caller, a, site) {
      const { data: p } = await ctx.db.from('profiles').select('id, stripe_subscription_id, active_plan, subscription_status').eq('id', site.owner_id).maybeSingle();
      if (!p) throw fail('That customer is gone.');
      try { return await changePlan(ctx.stripe(), ctx.db, p.id, p, a.plan, true); }
      catch (e) { if (e.httpStatus) throw fail(e.message); if (e.type === 'StripeCardError') throw fail('The card was declined, so the plan has not changed.'); throw e; }
    }
  },

  membership_cancel: {
    who: 'any', scope: 'site',
    description: 'Set this site’s subscription to end at the period end, never immediately. undo: true switches it back on.',
    input: withSite({ undo: { type: 'boolean' } }),
    async preview(ctx, caller, a, site) {
      const p = site.profile;
      if (!p.stripe_subscription_id) throw fail('There is no subscription to change on this site.');
      const sub = await ctx.stripe().subscriptions.retrieve(p.stripe_subscription_id);
      const end = sub.cancel_at || sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || null;
      const undo = !!a.undo;
      if (!undo && sub.cancel_at_period_end) throw fail('It is already set to end' + (end ? ' on ' + when(new Date(end * 1000).toISOString()) : '') + '.');
      if (undo && !sub.cancel_at_period_end) throw fail('It is not set to cancel, so there is nothing to undo.');
      const name = caller.is_admin ? person(p, site.email) + '’s' : 'your';
      return { preview: undo
        ? 'Keep ' + name + ' ' + PLAN_NAME[p.active_plan] + ' plan running. Stripe stops the cancellation and bills as normal from the next renewal.'
        : 'End ' + name + ' ' + PLAN_NAME[p.active_plan] + ' plan at the period end' + (end ? ', ' + when(new Date(end * 1000).toISOString()) : '') + '. Nothing refunded, nothing more billed, the site stays up until then. Reversible with undo: true.', args: { undo } };
    },
    async execute(ctx, caller, a, site) {
      const { data: p } = await ctx.db.from('profiles').select('stripe_subscription_id').eq('id', site.owner_id).maybeSingle();
      if (!p || !p.stripe_subscription_id) throw fail('No subscription to change.');
      const sub = await ctx.stripe().subscriptions.update(p.stripe_subscription_id, { cancel_at_period_end: !a.undo });
      const end = sub.cancel_at || sub.current_period_end || null;
      return { cancel_at_period_end: !!sub.cancel_at_period_end, ends: end ? new Date(end * 1000).toISOString() : null };
    }
  },

  refund: {
    who: 'admin', scope: 'site',
    description: 'Admin: refund one of this site’s payments, full or partial. payment_id from orders_list (in_, pi_ or ch_). amount_pence defaults to what is still refundable.',
    input: withSite({ payment_id: { type: 'string' }, amount_pence: { type: 'integer', minimum: 1 }, reason: { type: 'string', enum: ['duplicate', 'fraudulent', 'requested_by_customer'] } }, ['payment_id']),
    async preview(ctx, caller, a, site) {
      const charge = await chargeFor(ctx, a.payment_id);
      const cus = typeof charge.customer === 'string' ? charge.customer : (charge.customer && charge.customer.id);
      if (!cus || cus !== site.profile.stripe_customer_id) throw denied('Permission denied: that payment is not on this site.');
      const left = charge.amount - (charge.amount_refunded || 0);
      if (left <= 0) throw fail('That payment of ' + money(charge.amount) + ' is already fully refunded.');
      const amount = a.amount_pence == null ? left : Math.round(Number(a.amount_pence));
      if (!Number.isFinite(amount) || amount <= 0) throw fail('The amount needs to be a whole number of pence.');
      if (amount > left) throw fail('Only ' + money(left) + ' of ' + money(charge.amount) + ' is left to refund.');
      const reason = a.reason || 'requested_by_customer';
      return { preview: 'Refund ' + money(amount) + ' of ' + money(charge.amount) + ' (' + (charge.description || 'payment') + ' on ' + when(new Date(charge.created * 1000).toISOString()) + ') to ' + person(site.profile, null) + ', reason: ' + reason.replace(/_/g, ' ') + '. Stripe returns it to their card within 5 to 10 days. The subscription is not changed.', args: { charge_id: charge.id, amount, reason } };
    },
    async execute(ctx, caller, a, site) {
      const charge = await ctx.stripe().charges.retrieve(a.charge_id);
      const cus = typeof charge.customer === 'string' ? charge.customer : (charge.customer && charge.customer.id);
      if (cus !== site.profile.stripe_customer_id) throw denied('Permission denied: that payment is not on this site.');
      const left = charge.amount - (charge.amount_refunded || 0);
      if (a.amount > left) throw fail('Only ' + money(left) + ' is left to refund now, so nothing was refunded. Ask for a fresh preview.');
      const r = await ctx.stripe().refunds.create({ charge: a.charge_id, amount: a.amount, reason: a.reason });
      return { refund_id: r.id, amount: money(r.amount), status: r.status };
    }
  },

  email_send: {
    who: 'admin', scope: 'site',
    description: 'Admin: a one-off email to this site’s owner, in the site’s template.',
    input: withSite({ subject: { type: 'string' }, body: { type: 'string', description: 'plain text, blank line between paragraphs' } }, ['subject', 'body']),
    async preview(ctx, caller, a, site) {
      const subject = String(a.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
      const body = String(a.body || '').replace(/\r\n/g, '\n').trim();
      if (!subject) throw fail('Give the email a subject.');
      if (body.length < 10) throw fail('A little more than that.');
      if (body.length > 6000) throw fail('Keep it under 6,000 characters.');
      if (!site.email) throw fail('That customer has no login email on file.');
      return { preview: 'Email ' + person(site.profile, site.email) + ' with the subject “' + subject + '”, in the kanvas.one template.\n\n' + body, args: { to: site.email, subject, body } };
    },
    async execute(ctx, caller, a) {
      const result = await sendEmail({ to: a.to, subject: a.subject, text: a.body + '\n\n' + ctx.site + '\n', html: emailHtml({ preheader: a.body.slice(0, 120), heading: a.subject, lines: paragraphs(a.body), footer: 'From Kane at Kanvas One.', footerLinks: standardFooter(ctx.site) }) });
      if (result !== 'sent') throw fail('The email did not send (' + result + ').');
      return { sent: true, to: a.to };
    }
  },

  customer_note: {
    who: 'admin', scope: 'site',
    description: 'Admin: add a private note to this site’s customer record. They never see it.',
    input: withSite({ text: { type: 'string' } }, ['text']),
    async preview(ctx, caller, a, site) {
      const text = String(a.text || '').trim();
      if (!text) throw fail('Write the note first.');
      return { preview: 'Add to ' + who(site.profile) + '’s private notes, dated today:\n\n“' + text + '”', args: { text } };
    },
    async execute(ctx, caller, a, site) {
      const { data: p } = await ctx.db.from('profiles').select('admin_notes').eq('id', site.owner_id).maybeSingle();
      const notes = ((p && p.admin_notes) ? p.admin_notes.trim() + '\n\n' : '') + new Date().toISOString().slice(0, 10) + ': ' + a.text;
      const { error } = await ctx.db.from('profiles').update({ admin_notes: notes.slice(0, 20000) }).eq('id', site.owner_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
  },

  site_set: {
    who: 'admin', scope: 'site',
    description: 'Admin: set this site’s address and status: building | live | paused. Going live sends the your-site-is-live email.',
    input: withSite({ site_url: { type: 'string' }, site_status: { type: 'string', enum: ['building', 'live', 'paused'] } }, ['site_status']),
    async preview(ctx, caller, a, site) {
      const url = a.site_url == null ? (site.url || site.profile.site_url || null) : String(a.site_url).trim() || null;
      if (a.site_status === 'live' && !url) throw fail('Add the address before marking it live.');
      const goingLive = a.site_status === 'live' && site.profile.site_status !== 'live';
      return { preview: 'Set ' + person(site.profile, site.email) + '’s site to ' + a.site_status + (url ? ' at ' + url : '') + (goingLive ? '. First time live, so they get the “Your site is live” email and a bell in their dashboard.' : '. No email.'), args: { site_url: url, site_status: a.site_status } };
    },
    async execute(ctx, caller, a, site) {
      const { data: before } = await ctx.db.from('profiles').select('site_status, business_name').eq('id', site.owner_id).maybeSingle();
      if (!before) throw fail('That customer is gone.');
      const { error } = await ctx.db.from('profiles').update({ site_url: a.site_url || null, site_status: a.site_status }).eq('id', site.owner_id);
      if (error) throw new Error(error.message);
      await ctx.db.from('sites').update({ url: a.site_url || null, status: a.site_status }).eq('id', site.id);
      if (a.site_status === 'live' && before.site_status !== 'live') {
        await notifySiteLive(ctx.db, site.owner_id, before.business_name, a.site_url);
        await notify(ctx.db, site.owner_id, 'Your site is live', 'It’s up at ' + a.site_url + '.', a.site_url);
      }
      return { site_status: a.site_status, site_url: a.site_url };
    }
  },

  lead_send_preview: {
    who: 'admin', scope: 'none',
    description: 'Admin: send a lead their finished free example page. again: true if it was already sent once.',
    input: { type: 'object', properties: { lead_id: { type: 'string' }, preview_url: { type: 'string' }, again: { type: 'boolean' } }, required: ['lead_id', 'preview_url'] },
    async preview(ctx, caller, a) {
      if (!isUuid(a.lead_id)) throw fail('Which lead? Give its id from leads_list.');
      const { data: lead } = await ctx.db.from('leads').select('*').eq('id', a.lead_id).maybeSingle();
      if (!lead) throw fail('That lead is gone.');
      const url = String(a.preview_url || '').trim();
      if (!/^https:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) throw fail('The example needs a full https:// address.');
      if (lead.preview_sent_at && !a.again) throw fail('This one was already sent on ' + when(lead.preview_sent_at) + '. Pass again: true if you mean to send it twice.');
      return { preview: 'Email ' + lead.email + ' (' + lead.business + ') their free example at ' + url + ', with the 50% off first month code. Marks the lead as sent.', args: { lead_id: lead.id, preview_url: url, again: !!a.again } };
    },
    async execute(ctx, caller, a) {
      const out = await sendLeadPreview(ctx.db, a.lead_id, a.preview_url, { again: a.again });
      if (out.error) throw fail(out.error);
      return { sent_at: out.sentAt };
    }
  },

  partner_mark_paid: {
    who: 'admin', scope: 'none',
    description: 'Admin: record a payout to a partner. Defaults to everything owed.',
    input: { type: 'object', properties: { partner_id: { type: 'string' }, amount_pence: { type: 'integer', minimum: 1 } }, required: ['partner_id'] },
    async preview(ctx, caller, a) {
      const partner = (await partnerBalances(ctx)).find((p) => p.partner_id === a.partner_id);
      if (!partner) throw fail('No partner with that id. See partners_list.');
      if (partner.owed_pence <= 0) throw fail('Nothing owed to ' + partner.name + ' right now.');
      const amount = a.amount_pence == null ? partner.owed_pence : Math.round(Number(a.amount_pence));
      if (!Number.isFinite(amount) || amount <= 0 || amount > partner.owed_pence) throw fail('Between 1p and ' + partner.owed + '.');
      return { preview: 'Record ' + money(amount) + ' paid to ' + partner.name + ', leaving ' + money(partner.owed_pence - amount) + ' owed. A ledger entry, not a transfer: pay them first.', args: { partner_id: a.partner_id, amount } };
    },
    async execute(ctx, caller, a) {
      const partner = (await partnerBalances(ctx)).find((p) => p.partner_id === a.partner_id);
      if (!partner || partner.owed_pence < a.amount) throw fail('The balance changed, so nothing was recorded. Ask for a fresh preview.');
      const { error } = await ctx.db.from('partner_payouts').insert({ partner_id: a.partner_id, amount_pence: a.amount });
      if (error) throw new Error(error.message);
      return { paid: money(a.amount), owed_now: money(partner.owed_pence - a.amount) };
    }
  }
};

/* --------------------------------------------------------- confirm flow -- */

async function confirmPending(ctx, caller, id) {
  if (!isUuid(id)) throw fail('confirm needs the confirmation_id from the preview.');
  const { data: row, error } = await ctx.db.from('mcp_pending_actions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw fail('No pending action with that id.');
  if ((row.user_id || null) !== (caller.user_id || null)) throw denied('Permission denied: that preview belongs to someone else.');
  if (row.cancelled_at) throw fail('That action was cancelled. Ask for a fresh preview.');
  if (row.executed_at) throw fail('That action was already done on ' + when(row.executed_at) + '. Ask for a fresh preview if you mean it again.');
  if (new Date(row.expires_at) < new Date()) throw fail('That preview expired after ' + PENDING_MINUTES + ' minutes. Ask for a fresh one.');

  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  let countQ = ctx.db.from('mcp_actions').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo);
  countQ = caller.user_id ? countQ.eq('user_id', caller.user_id) : countQ.is('user_id', null);
  const { count } = await countQ;
  if ((count || 0) >= HOURLY_LIMIT) throw fail('That is ' + HOURLY_LIMIT + ' confirmed actions in the last hour, the limit. Wait a little.');

  const { data: claimed, error: claimErr } = await ctx.db.from('mcp_pending_actions').update({ executed_at: new Date().toISOString() }).eq('id', id).is('executed_at', null).select();
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed || !claimed.length) throw fail('That action was just confirmed elsewhere.');

  const tool = writeTools[row.tool];
  if (!tool) throw fail('Unknown tool ' + row.tool + '.');
  // The site is checked again at confirm time, not trusted from the row.
  const site = tool.scope === 'site' ? await siteFor(ctx, caller, row.site_id) : null;
  if (tool.who === 'admin' && !caller.is_admin) throw denied('Permission denied: that is an admin action.');
  let result;
  try { result = await tool.execute(ctx, caller, row.args || {}, site); }
  catch (e) { await ctx.db.from('mcp_pending_actions').update({ result: { error: e.message } }).eq('id', id); throw e; }
  await ctx.db.from('mcp_pending_actions').update({ result }).eq('id', id);
  await ctx.db.from('mcp_actions').insert({ pending_id: id, user_id: caller.user_id, site_id: row.site_id, tool: row.tool, args: row.args, preview: row.preview, result });
  return { tool: row.tool, preview: row.preview, result };
}

async function cancelPending(ctx, caller, id) {
  if (!isUuid(id)) throw fail('cancel needs the confirmation_id from the preview.');
  const { data: row } = await ctx.db.from('mcp_pending_actions').select('id, user_id, executed_at, cancelled_at, preview').eq('id', id).maybeSingle();
  if (!row) throw fail('No pending action with that id.');
  if ((row.user_id || null) !== (caller.user_id || null)) throw denied('Permission denied: that preview belongs to someone else.');
  if (row.executed_at) throw fail('Too late, that one already ran.');
  if (!row.cancelled_at) await ctx.db.from('mcp_pending_actions').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
  return { cancelled: true, preview: row.preview };
}

/* ----------------------------------------------------------- the tools -- */

function allowed(tool, caller) { return tool.who === 'any' || caller.is_admin; }

function toolsFor(caller) {
  const list = [];
  Object.keys(readTools).forEach((name) => { const t = readTools[name]; if (allowed(t, caller)) list.push({ name, description: t.description, inputSchema: t.input }); });
  Object.keys(writeTools).forEach((name) => { const t = writeTools[name]; if (allowed(t, caller)) list.push({ name, description: '[needs confirm] ' + t.description + ' First call returns a preview and a confirmation_id; nothing happens until confirm(confirmation_id).', inputSchema: t.input }); });
  list.push({ name: 'confirm', description: 'Run a previewed action. Once, within ' + PENDING_MINUTES + ' minutes, and only your own previews.', inputSchema: { type: 'object', properties: { confirmation_id: { type: 'string' } }, required: ['confirmation_id'] } });
  list.push({ name: 'cancel', description: 'Drop a previewed action without running it.', inputSchema: { type: 'object', properties: { confirmation_id: { type: 'string' } }, required: ['confirmation_id'] } });
  return list;
}

async function callTool(ctx, caller, name, args) {
  args = args && typeof args === 'object' ? args : {};
  const READ_ONLY_TEXT = 'Read-only mode. Set MCP_READ_ONLY=false in Vercel to allow actions from chat.';

  if (readTools[name]) {
    const t = readTools[name];
    if (!allowed(t, caller)) throw denied('Permission denied: that tool is for the admin.');
    const site = t.scope === 'site' ? await siteFor(ctx, caller, args.site_id) : null;
    return { text: JSON.stringify(await t.run(ctx, caller, args, site), null, 2) };
  }
  if (name === 'confirm') {
    if (readOnly()) return { text: READ_ONLY_TEXT, isError: true };
    const out = await confirmPending(ctx, caller, args.confirmation_id);
    return { text: 'Done: ' + out.preview.split('\n')[0] + '\n\nResult: ' + JSON.stringify(out.result) };
  }
  if (name === 'cancel') {
    const out = await cancelPending(ctx, caller, args.confirmation_id);
    return { text: 'Cancelled: ' + out.preview.split('\n')[0] };
  }
  const tool = writeTools[name];
  if (!tool) return { text: 'Unknown tool: ' + name, isError: true };
  if (!allowed(tool, caller)) throw denied('Permission denied: that tool is for the admin.');
  if (readOnly()) return { text: READ_ONLY_TEXT, isError: true };
  const site = tool.scope === 'site' ? await siteFor(ctx, caller, args.site_id) : null;
  const { preview, args: clean } = await tool.preview(ctx, caller, args, site);
  const expires = new Date(Date.now() + PENDING_MINUTES * 60000).toISOString();
  const { data: pending, error } = await ctx.db.from('mcp_pending_actions').insert({ tool: name, args: clean, preview, expires_at: expires, user_id: caller.user_id, site_id: site ? site.id : null }).select().single();
  if (error) throw new Error(error.message);
  return { text: 'Preview, nothing done yet:\n\n' + preview + '\n\nTo go ahead, call confirm with confirmation_id ' + pending.id + ' (valid for ' + PENDING_MINUTES + ' minutes). To drop it, call cancel with the same id.' };
}

/* ------------------------------------------------------------ JSON-RPC -- */

function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }

async function handleMessage(ctx, caller, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg && msg.id != null ? msg.id : null, -32600, 'Invalid request');
  if (msg.id === undefined) return null;
  const id = msg.id;
  const params = msg.params || {};
  switch (msg.method) {
    case 'initialize':
      return rpcResult(id, { protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: (caller.is_admin ? 'Kanvas One admin. ' : 'Your Kanvas One site. ') + 'Start with list_sites and pass a site_id to everything else. Read tools answer straight away. Every write tool returns a preview and a confirmation_id first; ask before confirming anything that sends email, changes a plan or moves money.' });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: toolsFor(caller) });
    case 'tools/call': {
      const name = String(params.name || '');
      try {
        const out = await callTool(ctx, caller, name, params.arguments);
        return rpcResult(id, { content: [{ type: 'text', text: out.text }], isError: !!out.isError });
      } catch (e) {
        if (e && e.shown) return rpcResult(id, { content: [{ type: 'text', text: e.message }], isError: true });
        console.error('mcp: %s failed:', name, e && e.message);
        return rpcResult(id, { content: [{ type: 'text', text: 'Something went wrong: ' + (e && e.message ? e.message : 'unknown error') }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, 'Method not found: ' + msg.method);
  }
}

/* The HTTP face, shared by api/mcp.js (bearer header) and api/mcp/[token].js
   (token in the path). `given` is whatever token the entry point found. */
async function serve(req, res, given) {
  const missing = missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (missing.length) { console.error('mcp: missing environment variables:', missing.join(', ')); res.status(500).json({ error: 'Not configured.' }); return; }

  const ctx = ctxFor();
  const caller = await resolveCaller(ctx, given);
  if (!caller) { res.status(401).end(); return; }

  if (req.method === 'GET') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'This server answers POST only.' }); return; }
  if (req.method === 'DELETE') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return; }

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (e) { res.status(400).json(rpcError(null, -32700, 'Parse error')); return; }
  if (!body) { res.status(400).json(rpcError(null, -32600, 'Invalid request')); return; }

  const messages = Array.isArray(body) ? body : [body];
  const answers = [];
  for (const m of messages) { const out = await handleMessage(ctx, caller, m); if (out) answers.push(out); }
  if (!answers.length) { res.status(202).end(); return; }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(Array.isArray(body) ? answers : answers[0]);
}

module.exports = { serve, ctxFor, resolveCaller, callTool, toolsFor, handleMessage, readOnly, TOKEN_PREFIX, sha, sitesFor, siteFor, isUuid };
