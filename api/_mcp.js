/* The MCP server: the admin side of kanvas.one, driven from a Claude chat.
 *
 * One JSON-RPC endpoint (Streamable HTTP, stateless) with a bearer token
 * or a token in the path. Read tools answer straight away. Every write
 * tool is two calls: the first validates, loads the real record and parks
 * a plain-English preview in mcp_pending_actions; confirm(id) runs it once
 * within ten minutes, cancel(id) drops it. Every executed action lands in
 * mcp_actions, which is also what the twenty-an-hour limit counts.
 *
 * Nothing here has its own way of doing things. Notes go through addNote
 * so the customer's dashboard and the ten-minute digest stay in step;
 * email goes through sendEmail in the site's template; plan changes go
 * through the same changePlan the account page uses; money only ever
 * moves through Stripe using ids from the profile, never from the chat.
 *
 * MCP_READ_ONLY: writes are refused unless it is exactly "false", so a
 * fresh deployment cannot send or charge anything until that is set.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { PLANS } = require('./_plans.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { notify } = require('./_notify.js');
const { addNote, listInbox, getThread, cleanBody } = require('./_requests.js');
const { notifySiteLive } = require('./_site_live.js');
const { sendLeadPreview } = require('./_previews.js');
const { changePlan } = require('./_change_plan.js');

const PROTOCOL = '2025-06-18';
const SERVER_INFO = { name: 'kanvas-one-admin', version: '1.0.0' };
const PENDING_MINUTES = 10;
const HOURLY_LIMIT = 20;
const PLAN_NAME = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'Max' };
const STATUS_WORD = { new: 'Open', waiting: 'Waiting on customer', in_progress: 'In progress', done: 'Done', declined: 'Done' };

/* ---------------------------------------------------------------- auth -- */

function tokenOk(given) {
  const want = process.env.MCP_ADMIN_TOKEN || '';
  if (!want || want.length < 24 || !given) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

function readOnly() { return String(process.env.MCP_READ_ONLY || '').toLowerCase() !== 'false'; }

/* ------------------------------------------------------------- helpers -- */

function money(pence) { return '£' + (Number(pence || 0) / 100).toFixed(2); }
function when(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }
function fail(message) { const e = new Error(message); e.shown = true; return e; }
function who(p) { return (p && (p.business_name || p.contact_name)) || 'this customer'; }
function person(p, email) { const name = who(p); return p && p.contact_name && p.business_name ? p.contact_name + ' (' + p.business_name + ')' : name + (email ? ' <' + email + '>' : ''); }

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

/* Emails live in auth.users; one pass over them, cached per request. */
async function emailMap(ctx) {
  if (ctx._emails) return ctx._emails;
  const byId = {}, byEmail = {};
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await ctx.db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error('mcp: listUsers failed:', error.message); break; }
    const users = (data && data.users) || [];
    users.forEach((u) => { byId[u.id] = u.email; if (u.email) byEmail[u.email.toLowerCase()] = u.id; });
    if (users.length < 200) break;
  }
  ctx._emails = { byId, byEmail };
  return ctx._emails;
}

async function emailOf(ctx, userId) {
  try {
    const { data } = await ctx.db.auth.admin.getUserById(userId);
    return (data && data.user && data.user.email) || null;
  } catch (e) { return null; }
}

/* A customer by profile id or login email. */
async function findCustomer(ctx, idOrEmail) {
  const key = String(idOrEmail || '').trim();
  if (!key) throw fail('Which customer? Give a profile id or their login email.');
  let id = key;
  if (!isUuid(key)) {
    const map = await emailMap(ctx);
    id = map.byEmail[key.toLowerCase()];
    if (!id) throw fail('No customer with the email ' + key + '.');
  }
  const { data: p, error } = await ctx.db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw fail('No customer with the id ' + id + '.');
  const email = await emailOf(ctx, id);
  return { profile: p, email };
}

async function findRequest(ctx, id) {
  if (!isUuid(id)) throw fail('Which request? Give its id from inbox_list.');
  const thread = await getThread(ctx.db, id);
  if (!thread) throw fail('No request with the id ' + id + '.');
  return thread;
}

function paragraphs(text) {
  return String(text).replace(/\r\n/g, '\n').split(/\n{2,}/).map((t) => esc(t.trim()).replace(/\n/g, '<br>')).filter(Boolean);
}

/* ---------------------------------------------------------- read tools -- */

const readTools = {
  summary: {
    description: 'The numbers at the top of the admin page: signed up, paying, live sites, open requests, waiting on me, and this month’s leads.',
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
      return {
        signed_up: all.count || 0, paying: paying.count || 0, live_sites: live.count || 0,
        open_requests: openRows.length,
        waiting_on_me: openRows.filter((r) => r.last_note_by === 'customer').length,
        leads_this_month: leads.count || 0,
        free_examples_waiting: previews.count || 0
      };
    }
  },

  inbox_list: {
    description: 'Every request (customer messages and website edit requests) with its newest note, waiting on me first. filter: mine | in_progress | waiting | done | all. search matches customer or title.',
    input: { type: 'object', properties: { filter: { type: 'string', enum: ['mine', 'in_progress', 'waiting', 'done', 'all'] }, search: { type: 'string' } } },
    async run(ctx, a) {
      const rows = await listInbox(ctx.db);
      const filter = a.filter || 'all';
      const q = String(a.search || '').toLowerCase();
      const done = (r) => r.status === 'done' || r.status === 'declined';
      const mine = (r) => r.last_note_by === 'customer' && !done(r);
      const rank = (r) => mine(r) ? 0 : r.status === 'in_progress' ? 1 : done(r) ? 3 : 2;
      return rows.filter((r) => {
        if (filter === 'mine' && !mine(r)) return false;
        if (filter === 'in_progress' && r.status !== 'in_progress') return false;
        if (filter === 'waiting' && rank(r) !== 2) return false;
        if (filter === 'done' && !done(r)) return false;
        if (q && !((r.business_name || '') + ' ' + (r.contact_name || '') + ' ' + r.title).toLowerCase().includes(q)) return false;
        return true;
      }).sort((x, y) => rank(x) - rank(y) || new Date(y.last_note_at) - new Date(x.last_note_at))
        .slice(0, 100)
        .map((r) => ({
          request_id: r.id, customer_id: r.user_id, customer: r.business_name || r.contact_name || null,
          title: r.title, kind: r.kind, status: STATUS_WORD[r.status] || r.status,
          whose_turn: mine(r) ? 'me' : done(r) ? 'nobody' : r.status === 'in_progress' ? 'me (building)' : 'customer',
          last_note: r.latest ? { by: r.latest.author === 'admin' ? 'me' : 'customer', text: r.latest.body, at: r.latest.created_at } : null,
          last_activity: r.last_note_at
        }));
    }
  },

  request_get: {
    description: 'One request in full: the customer, and the whole thread oldest first, private notes included.',
    input: { type: 'object', properties: { request_id: { type: 'string' } }, required: ['request_id'] },
    async run(ctx, a) {
      const t = await findRequest(ctx, a.request_id);
      return {
        request: Object.assign({}, t.request, { status: STATUS_WORD[t.request.status] || t.request.status }),
        customer: { customer_id: t.customer.id, business: t.customer.business_name, name: t.customer.contact_name, email: t.customer.email, plan: PLAN_NAME[t.customer.active_plan] || null, site_url: t.customer.site_url, site_status: t.customer.site_status },
        notes: t.notes.map((n) => ({ by: n.author === 'admin' ? 'me' : 'customer', private: !!n.private, text: n.body, attachments: (n.attachments || []).map((x) => x.url), at: n.created_at }))
      };
    }
  },

  customers_list: {
    description: 'Customers and sign-ups. search matches business, name or email; plan: starter | business | max; status: paying | not_paying | live | building.',
    input: { type: 'object', properties: { search: { type: 'string' }, plan: { type: 'string', enum: ['starter', 'business', 'max'] }, status: { type: 'string', enum: ['paying', 'not_paying', 'live', 'building'] } } },
    async run(ctx, a) {
      const { data, error } = await ctx.db.from('profiles')
        .select('id, business_name, contact_name, business_type, active_plan, subscription_status, current_period_end, site_url, site_status, created_at')
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      const map = await emailMap(ctx);
      const q = String(a.search || '').toLowerCase();
      return (data || []).map((p) => Object.assign({ email: map.byId[p.id] || null }, p)).filter((p) => {
        const paying = p.subscription_status === 'active' || p.subscription_status === 'trialing';
        if (a.plan && p.active_plan !== a.plan) return false;
        if (a.status === 'paying' && !paying) return false;
        if (a.status === 'not_paying' && paying) return false;
        if (a.status === 'live' && p.site_status !== 'live') return false;
        if (a.status === 'building' && p.site_status !== 'building') return false;
        if (q && !((p.business_name || '') + ' ' + (p.contact_name || '') + ' ' + (p.email || '')).toLowerCase().includes(q)) return false;
        return true;
      }).slice(0, 200).map((p) => ({
        customer_id: p.id, business: p.business_name, name: p.contact_name, email: p.email, type: p.business_type,
        plan: PLAN_NAME[p.active_plan] || null, subscription: p.subscription_status || 'none', renews: p.current_period_end,
        site_url: p.site_url, site_status: p.site_status, joined: p.created_at
      }));
    }
  },

  customer_get: {
    description: 'One customer by profile id or login email: plan, subscription, site, open requests, recent payments, private admin notes.',
    input: { type: 'object', properties: { customer: { type: 'string', description: 'profile id or email' } }, required: ['customer'] },
    async run(ctx, a) {
      const { profile: p, email } = await findCustomer(ctx, a.customer);
      const { data: reqs } = await ctx.db.from('requests').select('id, title, status, kind, last_note_by, last_note_at')
        .eq('user_id', p.id).order('last_note_at', { ascending: false }).limit(20);
      let payments = [];
      if (p.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
        try {
          const inv = await ctx.stripe().invoices.list({ customer: p.stripe_customer_id, limit: 6 });
          payments = (inv.data || []).map(invoiceRow);
        } catch (e) { console.error('mcp: invoices failed:', e && e.message); }
      }
      return {
        customer_id: p.id, business: p.business_name, name: p.contact_name, email, phone: p.phone || null, type: p.business_type,
        plan: PLAN_NAME[p.active_plan] || null, subscription: p.subscription_status || 'none', renews: p.current_period_end,
        site_url: p.site_url, site_status: p.site_status, joined: p.created_at,
        requests: (reqs || []).map((r) => ({ request_id: r.id, title: r.title, kind: r.kind, status: STATUS_WORD[r.status] || r.status, whose_turn: r.last_note_by === 'customer' && r.status !== 'done' ? 'me' : 'customer', last_activity: r.last_note_at })),
        payments,
        admin_notes: p.admin_notes || null
      };
    }
  },

  payments_list: {
    description: 'Stripe invoices (this business has no separate orders): amount, status, date, plan, refunds. customer narrows to one customer; since is an ISO date.',
    input: { type: 'object', properties: { customer: { type: 'string' }, since: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } } },
    async run(ctx, a) {
      const args = { limit: Math.min(Number(a.limit) || 25, 100), expand: ['data.charge'] };
      if (a.customer) { const { profile } = await findCustomer(ctx, a.customer); if (!profile.stripe_customer_id) return []; args.customer = profile.stripe_customer_id; }
      if (a.since) { const d = new Date(a.since); if (!isNaN(d)) args.created = { gte: Math.floor(d.getTime() / 1000) }; }
      let inv;
      try { inv = await ctx.stripe().invoices.list(args); }
      catch (e) { delete args.expand; inv = await ctx.stripe().invoices.list(args); }
      const rows = (inv.data || []).map(invoiceRow);
      const ids = Array.from(new Set(rows.map((r) => r.stripe_customer).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await ctx.db.from('profiles').select('id, business_name, contact_name, stripe_customer_id').in('stripe_customer_id', ids);
        const byCus = {}; (profs || []).forEach((p) => { byCus[p.stripe_customer_id] = p; });
        rows.forEach((r) => { const p = byCus[r.stripe_customer]; if (p) { r.customer_id = p.id; r.customer = p.business_name || p.contact_name; } });
      }
      return rows;
    }
  },

  memberships_list: {
    description: 'Every subscription from Stripe joined to the customer: plan, monthly or annual, status, renews, set to cancel. status: active | cancelling | past_due | canceled | all.',
    input: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'cancelling', 'past_due', 'canceled', 'all'] } } },
    async run(ctx, a) {
      const subs = await ctx.stripe().subscriptions.list({ status: 'all', limit: 100 });
      const ids = (subs.data || []).map((s) => s.id);
      const { data: profs } = ids.length ? await ctx.db.from('profiles').select('id, business_name, contact_name, active_plan, stripe_subscription_id').in('stripe_subscription_id', ids) : { data: [] };
      const bySub = {}; (profs || []).forEach((p) => { bySub[p.stripe_subscription_id] = p; });
      const want = a.status || 'active';
      return (subs.data || []).map((s) => {
        const item = s.items && s.items.data && s.items.data[0];
        const p = bySub[s.id] || {};
        const end = s.current_period_end || (item && item.current_period_end) || null;
        return {
          customer_id: p.id || null, customer: p.business_name || p.contact_name || null,
          plan: PLAN_NAME[(s.metadata && s.metadata.plan) || p.active_plan] || ((item && item.price && item.price.nickname) || null),
          interval: item && item.price && item.price.recurring ? item.price.recurring.interval : null,
          amount: item && item.price ? money(item.price.unit_amount) : null,
          status: s.status, cancel_at_period_end: !!s.cancel_at_period_end,
          renews: end ? new Date(end * 1000).toISOString() : null,
          subscription_id: s.id
        };
      }).filter((r) => want === 'all' ? true
        : want === 'cancelling' ? (r.cancel_at_period_end && r.status === 'active')
        : want === 'active' ? (r.status === 'active' || r.status === 'trialing')
        : r.status === want);
    }
  },

  leads_list: {
    description: 'Free example page enquiries. stage: waiting (example not sent yet) | sent | all.',
    input: { type: 'object', properties: { stage: { type: 'string', enum: ['waiting', 'sent', 'all'] } } },
    async run(ctx, a) {
      const COLS = 'id, business, email, source, handle, requested_domain, preview_url, preview_sent_at, created_at';
      const { data, error } = await ctx.db.from('leads').select(COLS).order('created_at', { ascending: false }).limit(300);
      if (error) throw new Error(error.message);
      const stage = a.stage || 'all';
      return (data || []).filter((l) => stage === 'all' ? true : stage === 'sent' ? !!l.preview_sent_at : (l.source === 'free-preview' && !l.preview_sent_at))
        .map((l) => ({ lead_id: l.id, business: l.business, email: l.email, source: l.source, handle: l.handle, wanted_domain: l.requested_domain, example_url: l.preview_url, example_sent: l.preview_sent_at, asked: l.created_at }));
    }
  },

  partners_list: {
    description: 'Partner balances: earned, paid out, owed, this month.',
    input: { type: 'object', properties: {} },
    async run(ctx) { return partnerBalances(ctx); }
  },

  actions_recent: {
    description: 'What has been done from chat: the audit log of confirmed actions, newest first.',
    input: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
    async run(ctx, a) {
      const { data, error } = await ctx.db.from('mcp_actions').select('id, tool, preview, result, created_at')
        .order('created_at', { ascending: false }).limit(Math.min(Number(a.limit) || 20, 100));
      if (error) throw new Error(error.message);
      return data || [];
    }
  }
};

function invoiceRow(inv) {
  const charge = inv.charge && typeof inv.charge === 'object' ? inv.charge : null;
  const line = inv.lines && inv.lines.data && inv.lines.data[0];
  return {
    payment_id: inv.id, number: inv.number, status: inv.status,
    amount: money(inv.amount_paid || inv.amount_due), refunded: charge ? money(charge.amount_refunded) : null,
    date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    description: line ? line.description : null,
    stripe_customer: typeof inv.customer === 'string' ? inv.customer : (inv.customer && inv.customer.id) || null,
    receipt: inv.hosted_invoice_url || null
  };
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

/* --------------------------------------------------------- write tools -- */
/* Each has preview(ctx, args) -> { preview, args } with args normalised to
   exactly what execute(ctx, args) will use, so what was confirmed is what
   runs. execute re-checks the live record before doing anything. */

const writeTools = {
  request_reply: {
    description: 'Reply on a request as me. Goes to the customer’s dashboard and, ten minutes later, their email. status: waiting (their turn, the default) | in_progress | done. private: true keeps it to me, no email.',
    input: { type: 'object', properties: { request_id: { type: 'string' }, body: { type: 'string' }, status: { type: 'string', enum: ['waiting', 'in_progress', 'done'] }, private: { type: 'boolean' } }, required: ['request_id', 'body'] },
    async preview(ctx, a) {
      const t = await findRequest(ctx, a.request_id);
      const text = String(a.body || '').replace(/\r\n/g, '\n').trim();
      if (!text) throw fail('Write the note first.');
      if (text.length > 4000) throw fail('Keep it under 4,000 characters.');
      const isPrivate = !!a.private;
      const status = isPrivate ? null : (a.status || 'waiting');
      const c = t.customer;
      const preview = isPrivate
        ? 'Private note on “' + t.request.title + '” (' + person(c, c.email) + '). Only I see it, no email, status stays ' + (STATUS_WORD[t.request.status] || t.request.status) + '.\n\n“' + text + '”'
        : 'Reply to ' + person(c, c.email) + ' on “' + t.request.title + '”. Status becomes ' + STATUS_WORD[status] + (status === 'done' ? ' (done_at set, feature added to their site list if it was a feature)' : '') + '. They see it in their dashboard now and get an email in about ten minutes' + (status === 'done' ? ' with the subject “Done: ' + t.request.title + '”' : status === 'waiting' ? ' with the subject “A quick question about your ' + t.request.title + '”' : ' with the subject “Update on your request: ' + t.request.title + '”') + '.\n\n“' + text + '”';
      return { preview, args: { request_id: t.request.id, body: text, status, private: isPrivate } };
    },
    async execute(ctx, a) {
      const { data: row, error } = await ctx.db.from('requests').select('*').eq('id', a.request_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw fail('That request is gone.');
      const out = await addNote(ctx.db, row, { author: 'admin', body: a.body, isPrivate: a.private, status: a.status || undefined });
      if (!a.private && out.request.status === 'done' && row.status !== 'done' && row.kind === 'feature') {
        const featName = String(out.request.title || row.detail).split('\n')[0].trim().slice(0, 200);
        const { data: existing } = await ctx.db.from('site_features').select('id').eq('user_id', row.user_id).ilike('name', featName).limit(1);
        if (existing && existing.length) await ctx.db.from('site_features').update({ updated_at: new Date().toISOString() }).eq('id', existing[0].id);
        else await ctx.db.from('site_features').insert({ user_id: row.user_id, name: featName });
      }
      return { note_id: out.note.id, status: STATUS_WORD[out.request.status] };
    }
  },

  request_set_status: {
    description: 'Move a request to Open or In progress without a note. Waiting on customer and Done need words, so use request_reply for those.',
    input: { type: 'object', properties: { request_id: { type: 'string' }, status: { type: 'string', enum: ['new', 'in_progress'] } }, required: ['request_id', 'status'] },
    async preview(ctx, a) {
      const t = await findRequest(ctx, a.request_id);
      if (!['new', 'in_progress'].includes(a.status)) throw fail('Only Open (new) or In progress here. Use request_reply for the others.');
      return { preview: 'Set “' + t.request.title + '” (' + person(t.customer, t.customer.email) + ') from ' + (STATUS_WORD[t.request.status] || t.request.status) + ' to ' + STATUS_WORD[a.status] + '. No email' + (a.status === 'in_progress' ? ', but their dashboard bell says it is being built' : '') + '.', args: { request_id: t.request.id, status: a.status } };
    },
    async execute(ctx, a) {
      const { data: row } = await ctx.db.from('requests').select('id, user_id, title, status').eq('id', a.request_id).maybeSingle();
      if (!row) throw fail('That request is gone.');
      const { error } = await ctx.db.from('requests').update({ status: a.status, done_at: null }).eq('id', a.request_id);
      if (error) throw new Error(error.message);
      if (a.status === 'in_progress' && row.status !== 'in_progress') await notify(ctx.db, row.user_id, 'Being built: ' + (row.title || 'your request'), 'We’re on it now.', '/requests.html#r/' + row.id);
      return { status: STATUS_WORD[a.status] };
    }
  },

  lead_send_preview: {
    description: 'Send a lead their finished free example page (the your-example-is-ready email with the offer code). again: true if it was already sent once.',
    input: { type: 'object', properties: { lead_id: { type: 'string' }, preview_url: { type: 'string' }, again: { type: 'boolean' } }, required: ['lead_id', 'preview_url'] },
    async preview(ctx, a) {
      if (!isUuid(a.lead_id)) throw fail('Which lead? Give its id from leads_list.');
      const { data: lead } = await ctx.db.from('leads').select('*').eq('id', a.lead_id).maybeSingle();
      if (!lead) throw fail('That lead is gone.');
      const url = String(a.preview_url || '').trim();
      if (!/^https:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) throw fail('The example needs a full https:// address.');
      if (lead.preview_sent_at && !a.again) throw fail('This one was already sent on ' + when(lead.preview_sent_at) + '. Pass again: true if you mean to send it twice.');
      return { preview: 'Email ' + lead.email + ' (' + lead.business + ') their free example at ' + url + (lead.requested_domain ? ', mentioning ' + lead.requested_domain : '') + ', with the 50% off first month code. Marks the lead as sent.', args: { lead_id: lead.id, preview_url: url, again: !!a.again } };
    },
    async execute(ctx, a) {
      const out = await sendLeadPreview(ctx.db, a.lead_id, a.preview_url, { again: a.again });
      if (out.error) throw fail(out.error);
      return { sent_at: out.sentAt };
    }
  },

  email_send: {
    description: 'A one-off email in the site’s template to a customer (profile id or email) or a lead (lead id). Never to anyone else.',
    input: { type: 'object', properties: { to: { type: 'string', description: 'customer id, customer email, or lead id' }, subject: { type: 'string' }, body: { type: 'string', description: 'plain text, blank line between paragraphs' } }, required: ['to', 'subject', 'body'] },
    async preview(ctx, a) {
      const subject = String(a.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
      const body = String(a.body || '').replace(/\r\n/g, '\n').trim();
      if (!subject) throw fail('Give the email a subject.');
      if (body.length < 10) throw fail('A little more than that.');
      if (body.length > 6000) throw fail('Keep it under 6,000 characters.');
      let to = null, name = null, kind = null, id = null;
      if (isUuid(a.to)) {
        const { data: lead } = await ctx.db.from('leads').select('id, email, business').eq('id', a.to).maybeSingle();
        if (lead) { to = lead.email; name = lead.business; kind = 'lead'; id = lead.id; }
      }
      if (!to) {
        const { profile, email } = await findCustomer(ctx, a.to);
        if (!email) throw fail('That customer has no login email on file.');
        to = email; name = person(profile, null); kind = 'customer'; id = profile.id;
      }
      return { preview: 'Email ' + name + ' <' + to + '> with the subject “' + subject + '”, in the kanvas.one template, from ' + (process.env.EMAIL_FROM || 'the site address') + '.\n\n' + body, args: { kind, id, to, subject, body } };
    },
    async execute(ctx, a) {
      const result = await sendEmail({
        to: a.to, subject: a.subject,
        text: a.body + '\n\n' + ctx.site + '\n',
        html: emailHtml({ preheader: a.body.slice(0, 120), heading: a.subject, lines: paragraphs(a.body), footer: 'From Kane at Kanvas One.', footerLinks: standardFooter(ctx.site) })
      });
      if (result !== 'sent') throw fail('The email did not send (' + result + ').');
      return { sent: true, to: a.to };
    }
  },

  membership_change_plan: {
    description: 'Move a customer to another plan on Stripe: starter | business | max. Upgrades bill the difference now; downgrades wait for the renewal. Same rules as their account page.',
    input: { type: 'object', properties: { customer: { type: 'string' }, plan: { type: 'string', enum: ['starter', 'business', 'max'] } }, required: ['customer', 'plan'] },
    async preview(ctx, a) {
      if (!PLANS[a.plan] || a.plan === 'pro') throw fail('Plans are starter, business or max.');
      const { profile: p, email } = await findCustomer(ctx, a.customer);
      let pv;
      try { pv = await changePlan(ctx.stripe(), ctx.db, p.id, p, a.plan, false); }
      catch (e) { if (e.httpStatus) throw fail(e.message); throw e; }
      const line = pv.upgrading
        ? 'Upgrade ' + person(p, email) + ' from ' + PLAN_NAME[pv.from] + ' to ' + PLAN_NAME[pv.to] + ' now. Stripe charges the difference today' + (typeof pv.dueNow === 'number' ? ', ' + money(pv.dueNow) : '') + ', then ' + money(PLANS[a.plan].amount) + ' a month from the next renewal. Their card must go through or nothing changes.'
        : 'Move ' + person(p, email) + ' from ' + PLAN_NAME[pv.from] + ' down to ' + PLAN_NAME[pv.to] + ' from their next renewal' + (pv.renewsAt ? ' on ' + when(new Date(pv.renewsAt * 1000).toISOString()) : '') + '. Nothing charged now; they keep what they paid for until then.';
      return { preview: line, args: { customer_id: p.id, plan: a.plan } };
    },
    async execute(ctx, a) {
      const { data: p } = await ctx.db.from('profiles').select('id, stripe_subscription_id, active_plan, subscription_status').eq('id', a.customer_id).maybeSingle();
      if (!p) throw fail('That customer is gone.');
      try { return await changePlan(ctx.stripe(), ctx.db, p.id, p, a.plan, true); }
      catch (e) { if (e.httpStatus) throw fail(e.message); if (e.type === 'StripeCardError') throw fail('Their card was declined, so the plan has not changed.'); throw e; }
    }
  },

  membership_cancel: {
    description: 'Set a customer’s subscription to end at the period end (never immediately). undo: true switches it back on.',
    input: { type: 'object', properties: { customer: { type: 'string' }, undo: { type: 'boolean' } }, required: ['customer'] },
    async preview(ctx, a) {
      const { profile: p, email } = await findCustomer(ctx, a.customer);
      if (!p.stripe_subscription_id) throw fail(who(p) + ' has no subscription to change.');
      const sub = await ctx.stripe().subscriptions.retrieve(p.stripe_subscription_id);
      const end = sub.cancel_at || sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || null;
      const undo = !!a.undo;
      if (!undo && sub.cancel_at_period_end) throw fail(who(p) + ' is already set to end' + (end ? ' on ' + when(new Date(end * 1000).toISOString()) : '') + '.');
      if (undo && !sub.cancel_at_period_end) throw fail(who(p) + ' is not set to cancel, so there is nothing to undo.');
      return { preview: undo
        ? 'Keep ' + person(p, email) + '’s ' + PLAN_NAME[p.active_plan] + ' plan running. Stripe stops the cancellation and bills as normal from the next renewal.'
        : 'End ' + person(p, email) + '’s ' + PLAN_NAME[p.active_plan] + ' plan at the period end' + (end ? ', ' + when(new Date(end * 1000).toISOString()) : '') + '. Nothing refunded, nothing more billed, site stays up until then. Reversible with undo: true.', args: { customer_id: p.id, undo } };
    },
    async execute(ctx, a) {
      const { data: p } = await ctx.db.from('profiles').select('stripe_subscription_id').eq('id', a.customer_id).maybeSingle();
      if (!p || !p.stripe_subscription_id) throw fail('No subscription to change.');
      const sub = await ctx.stripe().subscriptions.update(p.stripe_subscription_id, { cancel_at_period_end: !a.undo });
      const end = sub.cancel_at || sub.current_period_end || null;
      return { cancel_at_period_end: !!sub.cancel_at_period_end, ends: end ? new Date(end * 1000).toISOString() : null };
    }
  },

  refund: {
    description: 'Refund a Stripe payment, full or partial. payment_id is an invoice (in_), payment intent (pi_) or charge (ch_) id from payments_list. amount_pence defaults to whatever is still refundable.',
    input: { type: 'object', properties: { payment_id: { type: 'string' }, amount_pence: { type: 'integer', minimum: 1 }, reason: { type: 'string', enum: ['duplicate', 'fraudulent', 'requested_by_customer'] } }, required: ['payment_id'] },
    async preview(ctx, a) {
      const charge = await chargeFor(ctx, a.payment_id);
      const left = charge.amount - (charge.amount_refunded || 0);
      if (left <= 0) throw fail('That payment of ' + money(charge.amount) + ' is already fully refunded.');
      const amount = a.amount_pence == null ? left : Math.round(Number(a.amount_pence));
      if (!Number.isFinite(amount) || amount <= 0) throw fail('The amount needs to be a whole number of pence.');
      if (amount > left) throw fail('Only ' + money(left) + ' of ' + money(charge.amount) + ' is left to refund.');
      const cus = typeof charge.customer === 'string' ? charge.customer : (charge.customer && charge.customer.id);
      const { data: p } = cus ? await ctx.db.from('profiles').select('id, business_name, contact_name').eq('stripe_customer_id', cus).maybeSingle() : { data: null };
      const reason = a.reason || 'requested_by_customer';
      return { preview: 'Refund ' + money(amount) + ' of ' + money(charge.amount) + ' (' + (charge.description || 'payment') + ' on ' + when(new Date(charge.created * 1000).toISOString()) + ') to ' + (p ? person(p, null) : 'the card on charge ' + charge.id) + ', reason: ' + reason.replace(/_/g, ' ') + '. Stripe returns it to their card within 5 to 10 days. Their subscription is not changed.', args: { charge_id: charge.id, amount, reason, customer_id: p ? p.id : null } };
    },
    async execute(ctx, a) {
      const charge = await ctx.stripe().charges.retrieve(a.charge_id);
      const left = charge.amount - (charge.amount_refunded || 0);
      if (a.amount > left) throw fail('Only ' + money(left) + ' is left to refund now, so nothing was refunded. Ask for a fresh preview.');
      const r = await ctx.stripe().refunds.create({ charge: a.charge_id, amount: a.amount, reason: a.reason });
      return { refund_id: r.id, amount: money(r.amount), status: r.status };
    }
  },

  partner_mark_paid: {
    description: 'Record a payout to a partner. Defaults to everything owed; amount_pence can be less.',
    input: { type: 'object', properties: { partner_id: { type: 'string' }, amount_pence: { type: 'integer', minimum: 1 } }, required: ['partner_id'] },
    async preview(ctx, a) {
      const partner = (await partnerBalances(ctx)).find((p) => p.partner_id === a.partner_id);
      if (!partner) throw fail('No partner with that id. See partners_list.');
      if (partner.owed_pence <= 0) throw fail('Nothing owed to ' + partner.name + ' right now.');
      const amount = a.amount_pence == null ? partner.owed_pence : Math.round(Number(a.amount_pence));
      if (!Number.isFinite(amount) || amount <= 0 || amount > partner.owed_pence) throw fail('Between 1p and ' + partner.owed + '.');
      return { preview: 'Record ' + money(amount) + ' paid to ' + partner.name + (partner.contact ? ' (' + partner.contact + ')' : '') + ', leaving ' + money(partner.owed_pence - amount) + ' owed. This is a ledger entry: it does not move money, so pay them first.', args: { partner_id: a.partner_id, amount } };
    },
    async execute(ctx, a) {
      const partner = (await partnerBalances(ctx)).find((p) => p.partner_id === a.partner_id);
      if (!partner || partner.owed_pence < a.amount) throw fail('The balance changed, so nothing was recorded. Ask for a fresh preview.');
      const { error } = await ctx.db.from('partner_payouts').insert({ partner_id: a.partner_id, amount_pence: a.amount });
      if (error) throw new Error(error.message);
      return { paid: money(a.amount), owed_now: money(partner.owed_pence - a.amount) };
    }
  },

  customer_note: {
    description: 'Add a private admin note to a customer’s record. They never see it.',
    input: { type: 'object', properties: { customer: { type: 'string' }, text: { type: 'string' } }, required: ['customer', 'text'] },
    async preview(ctx, a) {
      const { profile: p } = await findCustomer(ctx, a.customer);
      const text = String(a.text || '').trim();
      if (!text) throw fail('Write the note first.');
      return { preview: 'Add to ' + who(p) + '’s private notes, dated today:\n\n“' + text + '”', args: { customer_id: p.id, text } };
    },
    async execute(ctx, a) {
      const { data: p } = await ctx.db.from('profiles').select('admin_notes').eq('id', a.customer_id).maybeSingle();
      const stamp = new Date().toISOString().slice(0, 10);
      const notes = ((p && p.admin_notes) ? p.admin_notes.trim() + '\n\n' : '') + stamp + ': ' + a.text;
      const { error } = await ctx.db.from('profiles').update({ admin_notes: notes.slice(0, 20000) }).eq('id', a.customer_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
  },

  site_set: {
    description: 'Set a customer’s site address and status: building | live | paused. Going live sends the your-site-is-live email.',
    input: { type: 'object', properties: { customer: { type: 'string' }, site_url: { type: 'string' }, site_status: { type: 'string', enum: ['building', 'live', 'paused'] } }, required: ['customer', 'site_status'] },
    async preview(ctx, a) {
      const { profile: p, email } = await findCustomer(ctx, a.customer);
      const url = a.site_url == null ? (p.site_url || null) : String(a.site_url).trim() || null;
      if (a.site_status === 'live' && !url) throw fail('Add the address before marking it live.');
      const goingLive = a.site_status === 'live' && p.site_status !== 'live';
      return { preview: 'Set ' + person(p, email) + '’s site to ' + a.site_status + (url ? ' at ' + url : '') + (goingLive ? '. This is the first time it goes live, so they get the “Your site is live” email and a bell in their dashboard.' : '. No email.'), args: { customer_id: p.id, site_url: url, site_status: a.site_status } };
    },
    async execute(ctx, a) {
      const { data: before } = await ctx.db.from('profiles').select('site_status, business_name').eq('id', a.customer_id).maybeSingle();
      if (!before) throw fail('That customer is gone.');
      const { error } = await ctx.db.from('profiles').update({ site_url: a.site_url || null, site_status: a.site_status }).eq('id', a.customer_id);
      if (error) throw new Error(error.message);
      if (a.site_status === 'live' && before.site_status !== 'live') {
        await notifySiteLive(ctx.db, a.customer_id, before.business_name, a.site_url);
        await notify(ctx.db, a.customer_id, 'Your site is live', 'It’s up at ' + a.site_url + '.', a.site_url);
      }
      return { site_status: a.site_status, site_url: a.site_url };
    }
  }
};

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

/* --------------------------------------------------------- confirm flow -- */

async function stagePending(ctx, tool, args, preview) {
  const expires = new Date(Date.now() + PENDING_MINUTES * 60000).toISOString();
  const { data, error } = await ctx.db.from('mcp_pending_actions').insert({ tool, args, preview, expires_at: expires }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function confirmPending(ctx, id) {
  if (!isUuid(id)) throw fail('confirm needs the confirmation_id from the preview.');
  const { data: row, error } = await ctx.db.from('mcp_pending_actions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw fail('No pending action with that id.');
  if (row.cancelled_at) throw fail('That action was cancelled. Ask for a fresh preview.');
  if (row.executed_at) throw fail('That action was already done on ' + when(row.executed_at) + '. Ask for a fresh preview if you mean it again.');
  if (new Date(row.expires_at) < new Date()) throw fail('That preview expired after ' + PENDING_MINUTES + ' minutes. Ask for a fresh one.');

  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count } = await ctx.db.from('mcp_actions').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo);
  if ((count || 0) >= HOURLY_LIMIT) throw fail('That is ' + HOURLY_LIMIT + ' confirmed actions in the last hour, the limit. Carry on in the admin page or wait a little.');

  /* Claim it in one statement: the row is ours only if nobody else got
     there first, so two confirms of one id cannot both run. */
  const now = new Date().toISOString();
  const { data: claimed, error: claimErr } = await ctx.db.from('mcp_pending_actions')
    .update({ executed_at: now }).eq('id', id).is('executed_at', null).select();
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed || !claimed.length) throw fail('That action was just confirmed elsewhere.');

  const tool = writeTools[row.tool];
  if (!tool) throw fail('Unknown tool ' + row.tool + '.');
  let result;
  try {
    result = await tool.execute(ctx, row.args || {});
  } catch (e) {
    await ctx.db.from('mcp_pending_actions').update({ result: { error: e.message } }).eq('id', id);
    throw e;
  }
  await ctx.db.from('mcp_pending_actions').update({ result }).eq('id', id);
  await ctx.db.from('mcp_actions').insert({ pending_id: id, tool: row.tool, args: row.args, preview: row.preview, result });
  return { tool: row.tool, preview: row.preview, result };
}

async function cancelPending(ctx, id) {
  if (!isUuid(id)) throw fail('cancel needs the confirmation_id from the preview.');
  const { data: row } = await ctx.db.from('mcp_pending_actions').select('id, executed_at, cancelled_at, preview').eq('id', id).maybeSingle();
  if (!row) throw fail('No pending action with that id.');
  if (row.executed_at) throw fail('Too late, that one already ran.');
  if (!row.cancelled_at) await ctx.db.from('mcp_pending_actions').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
  return { cancelled: true, preview: row.preview };
}

/* --------------------------------------------------------- tool listing -- */

function toolList() {
  const list = [];
  Object.keys(readTools).forEach((name) => list.push({ name, description: readTools[name].description, inputSchema: readTools[name].input }));
  Object.keys(writeTools).forEach((name) => list.push({ name, description: '[needs confirm] ' + writeTools[name].description + ' First call returns a preview and a confirmation_id; nothing happens until confirm(confirmation_id).', inputSchema: writeTools[name].input }));
  list.push({ name: 'confirm', description: 'Run a previewed action. Only works once, within ' + PENDING_MINUTES + ' minutes of the preview.', inputSchema: { type: 'object', properties: { confirmation_id: { type: 'string' } }, required: ['confirmation_id'] } });
  list.push({ name: 'cancel', description: 'Drop a previewed action without running it.', inputSchema: { type: 'object', properties: { confirmation_id: { type: 'string' } }, required: ['confirmation_id'] } });
  return list;
}

async function callTool(ctx, name, args) {
  args = args && typeof args === 'object' ? args : {};
  if (readTools[name]) return { text: JSON.stringify(await readTools[name].run(ctx, args), null, 2) };
  if (name === 'confirm') {
    if (readOnly()) return { text: 'Read-only mode. Set MCP_READ_ONLY=false in Vercel to allow actions from chat.', isError: true };
    const out = await confirmPending(ctx, args.confirmation_id);
    return { text: 'Done: ' + out.preview.split('\n')[0] + '\n\nResult: ' + JSON.stringify(out.result) };
  }
  if (name === 'cancel') {
    const out = await cancelPending(ctx, args.confirmation_id);
    return { text: 'Cancelled: ' + out.preview.split('\n')[0] };
  }
  const tool = writeTools[name];
  if (!tool) return { text: 'Unknown tool: ' + name, isError: true };
  if (readOnly()) return { text: 'Read-only mode. Set MCP_READ_ONLY=false in Vercel to allow actions from chat.', isError: true };
  const { preview, args: clean } = await tool.preview(ctx, args);
  const pending = await stagePending(ctx, name, clean, preview);
  return { text: 'Preview, nothing done yet:\n\n' + preview + '\n\nTo go ahead, call confirm with confirmation_id ' + pending.id + ' (valid for ' + PENDING_MINUTES + ' minutes). To drop it, call cancel with the same id.' };
}

/* ------------------------------------------------------------ JSON-RPC -- */

function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }

async function handleMessage(ctx, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg && msg.id != null ? msg.id : null, -32600, 'Invalid request');
  const isNotification = msg.id === undefined;
  if (isNotification) return null;   // notifications/initialized and friends: nothing to say back
  const id = msg.id;
  const params = msg.params || {};
  switch (msg.method) {
    case 'initialize':
      return rpcResult(id, { protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: 'Admin for kanvas.one. Read tools answer straight away. Every write tool returns a preview and a confirmation_id first; call confirm to run it. Ask before confirming anything that sends email, refunds money or changes a plan.' });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: toolList() });
    case 'tools/call': {
      const name = String(params.name || '');
      try {
        const out = await callTool(ctx, name, params.arguments);
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
   (token in the path). `given` is whichever token the entry point found. */
async function serve(req, res, given) {
  if (!tokenOk(given)) { res.status(401).end(); return; }

  const missing = missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (missing.length) { console.error('mcp: missing environment variables:', missing.join(', ')); res.status(500).json({ error: 'Not configured.' }); return; }

  if (req.method === 'GET') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'This server answers POST only.' }); return; }
  if (req.method === 'DELETE') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return; }

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (e) { res.status(400).json(rpcError(null, -32700, 'Parse error')); return; }
  if (!body) { res.status(400).json(rpcError(null, -32600, 'Invalid request')); return; }

  const ctx = ctxFor();
  const messages = Array.isArray(body) ? body : [body];
  const answers = [];
  for (const m of messages) {
    const out = await handleMessage(ctx, m);
    if (out) answers.push(out);
  }
  if (!answers.length) { res.status(202).end(); return; }
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(Array.isArray(body) ? answers : answers[0]);
}

module.exports = { serve, tokenOk, readOnly, toolList, callTool, handleMessage, readTools, writeTools };
